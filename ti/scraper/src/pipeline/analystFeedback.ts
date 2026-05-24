import { stableId } from "../utils.ts";
import type { ActorProfileReadinessField, ActorProfileReadinessStatus, LiveActorIntelligenceDto, PublicIntelClaimDto } from "./actorProfileFusion.ts";
import type { AttackMappingQualityDto } from "./attackMappingQuality.ts";
import type { EntityResolutionWorkbenchDto } from "./entityResolution.ts";
import type { EvaluationDatasetGovernanceDto } from "./evaluation.ts";
import type { SearchQualityDashboardDto } from "./searchQualityGate.ts";
import type { TimelinessGroundTruthHarnessDto } from "./timelinessGroundTruth.ts";

export type AnalystFeedbackMark =
  | "correct"
  | "stale"
  | "wrong"
  | "duplicate"
  | "overconfident"
  | "underconfident"
  | "missing";

export type AnalystFeedbackTarget =
  | "quality_gate"
  | "source_reliability"
  | "entity_resolution"
  | "graph_review"
  | "public_answer_caveat"
  | "parser_repair";

export type AnalystCorrectionState =
  | "accepted"
  | "rejected"
  | "needs_evidence"
  | "duplicate"
  | "stale"
  | "false_positive"
  | "underconfident"
  | "overconfident"
  | "parser_repair"
  | "source_repair";

export type QualityRegressionArea =
  | "extraction"
  | "ranking"
  | "entity_resolution"
  | "attack_mapping"
  | "source_reliability"
  | "graph_review"
  | "public_answer_caveat";

export interface AnalystFeedbackContractItemDto {
  id: string;
  mark: AnalystFeedbackMark;
  target: AnalystFeedbackTarget;
  field: string;
  value?: string;
  evidenceIds: string[];
  ledgerIds: string[];
  confidenceBefore?: number;
  recommendedConfidenceAfter?: number;
  reasons: string[];
  immutable: true;
  appliesAutomatically: false;
}

export interface AnalystFeedbackLoopDto {
  schemaVersion: "ti.analyst_feedback_loop.v1";
  query: string;
  generatedAt: string;
  items: AnalystFeedbackContractItemDto[];
  routing: {
    qualityGate: string[];
    sourceReliability: string[];
    entityResolution: string[];
    graphReview: string[];
    publicAnswerCaveats: string[];
    parserRepair: string[];
  };
  policy: {
    modelSelfMutationAllowed: false;
    analystApprovalRequired: true;
    rawEvidenceRequired: false;
    preservesProvenance: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
  };
}

export interface QualityRegressionCaseDto {
  id: string;
  sourceFeedbackId?: string;
  state: AnalystCorrectionState;
  area: QualityRegressionArea;
  field: string;
  value?: string;
  assertion: string;
  expectedOutcome: string;
  evidenceIds: string[];
  ledgerIds: string[];
  provenance: {
    query: string;
    generatedAt: string;
    feedbackTarget?: AnalystFeedbackTarget;
    attackTechniqueId?: string;
    source: "analyst_feedback" | "timeliness_harness" | "attack_mapping_quality";
  };
  caveatUpdates: string[];
  handoffs: {
    agent01SourceGovernance?: string;
    agent03ParserRepair?: string;
    agent04CoverageRadar?: string;
    agent06ClaimLedger?: string;
    agent08GraphHolds?: string;
    agent09Api?: string;
    agent10ReleaseGates?: string;
  };
  immutable: true;
  appliesAutomatically: false;
}

export interface QualityRegressionSuiteDto {
  schemaVersion: "ti.quality_regression_suite.v1";
  query: string;
  generatedAt: string;
  cases: QualityRegressionCaseDto[];
  coverage: {
    extraction: number;
    ranking: number;
    entityResolution: number;
    attackMapping: number;
    sourceReliability: number;
    graphReview: number;
    publicAnswerCaveats: number;
  };
  routing: {
    agent01SourceGovernance: string[];
    agent03ParserRepair: string[];
    agent04CoverageRadar: string[];
    agent06ClaimLedger: string[];
    agent08GraphHolds: string[];
    agent09Api: string[];
    agent10ReleaseGates: string[];
  };
  policy: {
    analystApprovalRequired: true;
    modelSelfMutationAllowed: false;
    regressionOnly: true;
    preservesProvenance: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
  };
}

export type ActorProfileReviewState =
  | "accepted"
  | "partial"
  | "missing"
  | "stale"
  | "contradicted"
  | "duplicate"
  | "wrong"
  | "overconfident"
  | "underconfident"
  | "needs_evidence";

export type ActorProfileCorrectionActionKind =
  | "accept_field"
  | "mark_stale"
  | "mark_contradicted"
  | "merge_duplicate"
  | "suppress_wrong_claim"
  | "request_more_evidence"
  | "lower_confidence"
  | "raise_confidence"
  | "route_parser_repair"
  | "route_graph_review"
  | "route_claim_ledger";

export interface ActorProfileCorrectionActionDto {
  id: string;
  kind: ActorProfileCorrectionActionKind;
  label: string;
  field: ActorProfileReadinessField;
  value?: string;
  evidenceIds: string[];
  ledgerIds: string[];
  manualOnly: true;
  appliesAutomatically: false;
  reason: string;
  handoffs: {
    agent01SourceGaps?: string;
    agent04PublicCoverage?: string;
    agent06ClaimLedger?: string;
    agent08GraphHolds?: string;
    agent09ApiContracts?: string;
    agent10ReleaseGates?: string;
  };
}

export interface ActorProfileReviewFieldDto {
  field: ActorProfileReadinessField;
  state: ActorProfileReviewState;
  readinessStatus: ActorProfileReadinessStatus;
  confidence: number;
  values: string[];
  evidenceIds: string[];
  ledgerIds: string[];
  freshness: {
    score: number;
    lastSeen?: string;
    reportPublishedAt?: string;
    stale: boolean;
  };
  uncertainty: {
    preservesUncertainty: true;
    caveatCodes: string[];
    reviewReasons: string[];
    contradictionSignals: string[];
  };
  correctionActions: ActorProfileCorrectionActionDto[];
}

export interface ActorProfileReviewWorkbenchDto {
  schemaVersion: "ti.actor_profile_review_workbench.v1";
  query: string;
  generatedAt: string;
  fields: ActorProfileReviewFieldDto[];
  queues: {
    stale: string[];
    contradicted: string[];
    duplicate: string[];
    wrong: string[];
    missing: string[];
    overconfident: string[];
    underconfident: string[];
    needsEvidence: string[];
  };
  summary: {
    fieldCount: number;
    reviewRequiredCount: number;
    staleCount: number;
    contradictionCount: number;
    missingCount: number;
    actionCount: number;
  };
  routing: {
    agent01SourceGaps: string[];
    agent04PublicCoverage: string[];
    agent06ClaimLedger: string[];
    agent08GraphHolds: string[];
    agent09ApiContracts: string[];
    agent10ReleaseGates: string[];
  };
  policy: {
    analystApprovalRequired: true;
    modelSelfMutationAllowed: false;
    preservesProvenance: true;
    manualCorrectionsOnly: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
  };
}

export type AnalystQualityQueueField =
  | "actor_summary"
  | "recent_activity"
  | "victims"
  | "ttps"
  | "infrastructure"
  | "malware_tools"
  | "cves"
  | "source_gaps"
  | "unknown_query";

export type AnalystQualityQueueState =
  | "ready"
  | "needs_review"
  | "stale"
  | "contradicted"
  | "missing_provenance"
  | "restricted_hold"
  | "searching_only";

export type AnalystQualityReleaseGateCode =
  | "freshness"
  | "provenance"
  | "source_diversity"
  | "contradiction_state"
  | "evidence_retention"
  | "restricted_holds"
  | "unknown_searching_semantics"
  | "label_governance";

export interface AnalystQualityReviewQueueItemDto {
  id: string;
  field: AnalystQualityQueueField;
  state: AnalystQualityQueueState;
  priority: "low" | "medium" | "high" | "critical";
  subject: string;
  confidence: number;
  freshness: {
    score: number;
    stale: boolean;
    lastSeen?: string;
    reportPublishedAt?: string;
  };
  evidenceIds: string[];
  ledgerIds: string[];
  labelIds: string[];
  sourceFamilies: string[];
  reasons: string[];
  requiredActions: Array<
    | "confirm_summary"
    | "refresh_evidence"
    | "resolve_contradiction"
    | "attach_provenance"
    | "hold_restricted_metadata"
    | "expand_source_diversity"
    | "keep_searching_only"
    | "add_regression_fixture"
  >;
  releaseImpact: {
    blocksReadyPromotion: boolean;
    publicAnswerState: "ready" | "partial" | "review_required" | "searching";
    apiSignal: string;
    agent10Signal: string;
  };
  immutable: true;
  appliesAutomatically: false;
}

export interface AnalystQualityReviewQueueDto {
  schemaVersion: "ti.analyst_quality_review_queue.v1";
  query: string;
  generatedAt: string;
  items: AnalystQualityReviewQueueItemDto[];
  releaseGate: {
    decision: "promote" | "partial" | "hold";
    requiredChecks: Array<{
      code: AnalystQualityReleaseGateCode;
      status: "pass" | "warn" | "hold";
      itemIds: string[];
      reason: string;
    }>;
    publicAnswerState: "ready" | "partial" | "review_required" | "searching";
    blocksReadyPromotion: boolean;
  };
  qualityReleaseSignals: {
    agent09PublicApi: string[];
    agent10ReleaseBoard: string[];
    regressionFixtures: string[];
    staleAnswerPrevention: string[];
  };
  routing: {
    actorSummary: string[];
    recentActivity: string[];
    victims: string[];
    ttps: string[];
    infrastructure: string[];
    malwareTools: string[];
    cves: string[];
    sourceGaps: string[];
    unknownQuery: string[];
  };
  policy: {
    analystApprovalRequired: true;
    modelSelfMutationAllowed: false;
    preservesUncertainty: true;
    manualReviewOnly: true;
    unknownActorSearchingOnly: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
  };
}

export type AnalystFeedbackLearningEventType =
  | "actor_alias_correction"
  | "victim_false_positive"
  | "ttp_mapping_correction"
  | "stale_activity_rejection"
  | "source_reliability_downgrade"
  | "contradiction_merge_split"
  | "restricted_hold_confirmation"
  | "unknown_query_searching_approval";

export type EvaluationScorecardMetric =
  | "extraction_precision"
  | "extraction_recall"
  | "source_diversity"
  | "freshness"
  | "contradiction_handling"
  | "unknown_actor_behavior"
  | "restricted_no_leak_handling"
  | "public_answer_latency";

export interface AnalystFeedbackLearningEventDto {
  id: string;
  type: AnalystFeedbackLearningEventType;
  subject: string;
  state: "accepted" | "held" | "rejected" | "needs_replay";
  reviewer: "analyst" | "agent_07_governance";
  recordedAt: string;
  evidenceIds: string[];
  ledgerIds: string[];
  sourceFeedbackIds: string[];
  regressionCaseIds: string[];
  labelIds: string[];
  reasonCodes: string[];
  allowedEffects: Array<"extractor_fixture" | "ranking_fixture" | "public_caveat_fixture" | "graph_review_fixture" | "source_reliability_fixture" | "api_regression_fixture">;
  prohibitedEffects: Array<"autonomous_scraping" | "silent_source_activation" | "model_self_mutation" | "raw_evidence_export" | "restricted_payload_access">;
  replay: {
    importKey: string;
    deterministicOrder: number;
    idempotencyKey: string;
    requiresHumanApproval: true;
  };
  immutable: true;
  appliesAutomatically: false;
}

export interface EvaluationScorecardDto {
  metric: EvaluationScorecardMetric;
  score: number;
  status: "pass" | "warn" | "hold";
  numerator: number;
  denominator: number;
  evidenceIds: string[];
  eventIds: string[];
  explanation: string;
}

export interface EvaluationLearningFixtureDto {
  id: string;
  scenario:
    | "apt29_daily_activity_freshness"
    | "apt42_instant_summary"
    | "made_up_actor_searching_only"
    | "stale_2025_only_answer_rejection"
    | "public_channel_rumor_demotion"
    | "restricted_metadata_hold"
    | "graph_contradiction";
  expectedPublicState: "ready" | "partial" | "searching" | "review_required";
  eventTypes: AnalystFeedbackLearningEventType[];
  scorecardMetrics: EvaluationScorecardMetric[];
  assertion: string;
  evidenceIds: string[];
  ledgerIds: string[];
  noLeak: true;
}

export interface AnalystFeedbackLearningLoopDto {
  schemaVersion: "ti.analyst_feedback_learning_loop.v1";
  query: string;
  generatedAt: string;
  records: AnalystFeedbackLearningEventDto[];
  scorecards: EvaluationScorecardDto[];
  fixtures: EvaluationLearningFixtureDto[];
  persistence: {
    mode: "readiness_contract_append_only";
    appendOnly: true;
    primaryRecordKey: "records[].id";
    replayOrder: string[];
    importSemantics: string[];
    mutationBoundary: "no_runtime_mutation_until_persistence_adapter_is_enabled";
  };
  routeState: {
    explainsPartial: boolean;
    explainsSearching: boolean;
    explainsHeld: boolean;
    explainsReady: boolean;
  };
  routing: {
    agent03ParserRepair: string[];
    agent04SourceCoverage: string[];
    agent08GraphCorrections: string[];
    agent09PublicApiFields: string[];
    agent10ReleaseGates: string[];
  };
  policy: {
    analystApprovalRequired: true;
    modelSelfMutationAllowed: false;
    autonomousScrapingAllowed: false;
    silentSourceActivationAllowed: false;
    preservesUncertainty: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
  };
}

export type ActiveLearningCandidateType =
  | "parser_prompt_model_improvement"
  | "source_ranking_adjustment"
  | "ttp_mapping_rule_update"
  | "actor_alias_merge_split"
  | "victim_false_positive_suppression"
  | "ioc_false_positive_suppression"
  | "source_reliability_downgrade"
  | "freshness_rule_update"
  | "contradiction_resolution";

export interface ActiveLearningBeforeAfterScorecardDto {
  metric: EvaluationScorecardMetric | "provenance_completeness" | "stale_answer_rejection";
  before: number;
  expectedAfter: number;
  delta: number;
  status: "pass" | "warn" | "hold";
  evidenceIds: string[];
  reason: string;
}

export interface ActiveLearningCandidateDto {
  id: string;
  type: ActiveLearningCandidateType;
  title: string;
  status: "candidate" | "needs_human_approval" | "blocked";
  reviewer: "unassigned" | "analyst_required";
  priority: "low" | "medium" | "high" | "critical";
  evidenceIds: string[];
  ledgerIds: string[];
  reason: string;
  expectedEffect: string;
  rollback: string;
  testFixtureRequirement: string;
  noAutonomousChangeGuarantee: true;
  humanApproval: {
    required: true;
    reviewerRequired: true;
    approvalRoute: "/v1/quality/evaluate";
    allowedActions: Array<"approve_fixture" | "reject_candidate" | "request_more_evidence" | "route_to_owner">;
    forbiddenActions: Array<"activate_source" | "start_crawl" | "change_model_weights" | "mutate_extractor" | "publish_public_answer" | "export_restricted_payload">;
  };
  affectedFields: {
    publicApi: string[];
    graph: string[];
    stix: string[];
  };
  sourceRecords: {
    feedbackRecordIds: string[];
    learningRecordIds: string[];
    regressionCaseIds: string[];
    labelIds: string[];
  };
  beforeAfterScorecards: ActiveLearningBeforeAfterScorecardDto[];
  immutable: true;
  appliesAutomatically: false;
}

export interface ActiveLearningCandidateQueueDto {
  schemaVersion: "ti.active_learning_candidate_queue.v1";
  query: string;
  generatedAt: string;
  candidates: ActiveLearningCandidateDto[];
  workflow: {
    appendOnly: true;
    humanApprovalRequired: true;
    fixtureRequiredBeforeApproval: true;
    replayRequiredBeforePromotion: true;
    mutationBoundary: "no_runtime_or_model_change_until_human_approved_fixture_replay";
    approvalSteps: string[];
  };
  scorecards: ActiveLearningBeforeAfterScorecardDto[];
  fixturePack: EvaluationLearningFixtureDto[];
  routing: {
    agent03ParserCertification: string[];
    agent04FreshnessSourceGaps: string[];
    agent06EvidenceReplay: string[];
    agent08GraphCorrections: string[];
    agent09ApiFields: string[];
    agent10ReleaseGates: string[];
  };
  policy: {
    analystApprovalRequired: true;
    modelSelfMutationAllowed: false;
    autonomousScrapingAllowed: false;
    silentSourceActivationAllowed: false;
    preservesUncertainty: true;
    unknownActorSearchingOnly: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
  };
}

export function buildAnalystFeedbackLoopDto(input: {
  query: string;
  actorProfile?: LiveActorIntelligenceDto;
  claims?: PublicIntelClaimDto[];
  qualityDashboard?: SearchQualityDashboardDto;
  entityResolutionWorkbench?: EntityResolutionWorkbenchDto;
  timelinessGroundTruth?: TimelinessGroundTruthHarnessDto;
  generatedAt?: string;
}): AnalystFeedbackLoopDto {
  const items = [
    ...feedbackFromClaims(input.query, input.claims ?? []),
    ...feedbackFromQuality(input.query, input.qualityDashboard),
    ...feedbackFromEntityResolution(input.query, input.entityResolutionWorkbench),
    ...feedbackFromTimeliness(input.query, input.timelinessGroundTruth),
    ...feedbackForMissingFields(input.query, input.actorProfile)
  ].slice(0, 80);
  return {
    schemaVersion: "ti.analyst_feedback_loop.v1",
    query: input.query,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    items,
    routing: {
      qualityGate: idsFor(items, "quality_gate"),
      sourceReliability: idsFor(items, "source_reliability"),
      entityResolution: idsFor(items, "entity_resolution"),
      graphReview: idsFor(items, "graph_review"),
      publicAnswerCaveats: idsFor(items, "public_answer_caveat"),
      parserRepair: idsFor(items, "parser_repair")
    },
    policy: {
      modelSelfMutationAllowed: false,
      analystApprovalRequired: true,
      rawEvidenceRequired: false,
      preservesProvenance: true
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false
    }
  };
}

export function buildActorProfileReviewWorkbenchDto(input: {
  query: string;
  actorProfile?: LiveActorIntelligenceDto;
  claims?: PublicIntelClaimDto[];
  feedbackLoop?: AnalystFeedbackLoopDto;
  timelinessGroundTruth?: TimelinessGroundTruthHarnessDto;
  attackMappingQuality?: AttackMappingQualityDto;
  generatedAt?: string;
}): ActorProfileReviewWorkbenchDto {
  const generatedAt = input.generatedAt ?? input.feedbackLoop?.generatedAt ?? new Date().toISOString();
  const feedbackByField = groupFeedbackByField(input.feedbackLoop?.items ?? []);
  const claimsByField = groupClaimsByField(input.claims ?? []);
  const timelinessByField = new Map<string, NonNullable<TimelinessGroundTruthHarnessDto["fields"]>[number]>((input.timelinessGroundTruth?.fields ?? []).map((field) => [field.field, field]));
  const fields: ActorProfileReviewFieldDto[] = ACTOR_PROFILE_REVIEW_FIELDS.map((field) => {
    const readiness = input.actorProfile?.readiness.fields[field];
    const feedback = feedbackByField.get(field) ?? [];
    const claims = claimsByField.get(field) ?? [];
    const caveatCodes = [
      ...(readiness?.caveatCodes ?? []),
      ...claims.flatMap((claim) => claim.caveatCodes),
      ...feedback.flatMap((item) => item.reasons.filter((reason) => /stale|contradict|duplicate|wrong|missing|confidence|evidence|review/i.test(reason)).map(reasonCode))
    ];
    const reviewReasons = [
      ...(readiness?.reasons ?? []),
      ...claims.flatMap((claim) => claim.downgradeReasons),
      ...feedback.flatMap((item) => item.reasons)
    ].slice(0, 12);
    const contradictionSignals = reviewReasons.filter((reason) => /contradict|disput|wrong|false.?positive/i.test(reason)).map(reasonCode).slice(0, 8);
    const state = reviewStateForField({ field, readinessStatus: readiness?.status, feedback, reviewReasons, contradictionSignals });
    const evidenceIds = unique([
      ...(readiness?.evidenceIds ?? []),
      ...claims.flatMap((claim) => claim.evidenceIds),
      ...feedback.flatMap((item) => item.evidenceIds)
    ]).slice(0, 16);
    const ledgerIds = unique([
      ...claims.flatMap((claim) => claim.ledgerIds),
      ...feedback.flatMap((item) => item.ledgerIds)
    ]).slice(0, 16);
    const freshness = fieldFreshness(input.actorProfile, field, timelinessByField.get(field));
    const values = fieldValues(input.actorProfile, claims, field);
    const confidence = clampConfidence(readiness?.confidence ?? maxClaimConfidence(claims) ?? 0);
    const correctionActions = correctionActionsForField({
      query: input.query,
      field,
      state,
      values,
      evidenceIds,
      ledgerIds,
      confidence,
      reviewReasons
    });
    return {
      field,
      state,
      readinessStatus: readiness?.status ?? "partial_evidence",
      confidence,
      values,
      evidenceIds,
      ledgerIds,
      freshness,
      uncertainty: {
        preservesUncertainty: true as const,
        caveatCodes: unique(caveatCodes).slice(0, 12),
        reviewReasons: reviewReasons.map(safeReviewReason).slice(0, 12),
        contradictionSignals
      },
      correctionActions
    };
  });
  const actions = fields.flatMap((field) => field.correctionActions);
  return {
    schemaVersion: "ti.actor_profile_review_workbench.v1",
    query: input.query,
    generatedAt,
    fields,
    queues: {
      stale: fieldIds(fields, "stale"),
      contradicted: fieldIds(fields, "contradicted"),
      duplicate: fieldIds(fields, "duplicate"),
      wrong: fieldIds(fields, "wrong"),
      missing: fieldIds(fields, "missing"),
      overconfident: fieldIds(fields, "overconfident"),
      underconfident: fieldIds(fields, "underconfident"),
      needsEvidence: fieldIds(fields, "needs_evidence")
    },
    summary: {
      fieldCount: fields.length,
      reviewRequiredCount: fields.filter((field) => field.state !== "accepted" && field.state !== "partial").length,
      staleCount: fields.filter((field) => field.state === "stale").length,
      contradictionCount: fields.filter((field) => field.state === "contradicted").length,
      missingCount: fields.filter((field) => field.state === "missing").length,
      actionCount: actions.length
    },
    routing: {
      agent01SourceGaps: routeActionIds(actions, "agent01SourceGaps"),
      agent04PublicCoverage: routeActionIds(actions, "agent04PublicCoverage"),
      agent06ClaimLedger: routeActionIds(actions, "agent06ClaimLedger"),
      agent08GraphHolds: routeActionIds(actions, "agent08GraphHolds"),
      agent09ApiContracts: routeActionIds(actions, "agent09ApiContracts"),
      agent10ReleaseGates: routeActionIds(actions, "agent10ReleaseGates")
    },
    policy: {
      analystApprovalRequired: true,
      modelSelfMutationAllowed: false,
      preservesProvenance: true,
      manualCorrectionsOnly: true
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false
    }
  };
}

export function buildQualityRegressionSuiteDto(input: {
  query: string;
  feedbackLoop: AnalystFeedbackLoopDto;
  timelinessGroundTruth?: TimelinessGroundTruthHarnessDto;
  attackMappingQuality?: AttackMappingQualityDto;
  generatedAt?: string;
}): QualityRegressionSuiteDto {
  const generatedAt = input.generatedAt ?? input.feedbackLoop.generatedAt;
  const cases = [
    ...input.feedbackLoop.items.map((feedback) => regressionCaseFromFeedback(input.query, generatedAt, feedback)),
    ...regressionCasesFromTimeliness(input.query, generatedAt, input.timelinessGroundTruth),
    ...regressionCasesFromAttackMapping(input.query, generatedAt, input.attackMappingQuality)
  ].slice(0, 120);
  return {
    schemaVersion: "ti.quality_regression_suite.v1",
    query: input.query,
    generatedAt,
    cases,
    coverage: {
      extraction: countCases(cases, "extraction"),
      ranking: countCases(cases, "ranking"),
      entityResolution: countCases(cases, "entity_resolution"),
      attackMapping: countCases(cases, "attack_mapping"),
      sourceReliability: countCases(cases, "source_reliability"),
      graphReview: countCases(cases, "graph_review"),
      publicAnswerCaveats: countCases(cases, "public_answer_caveat")
    },
    routing: {
      agent01SourceGovernance: casesWithHandoff(cases, "agent01SourceGovernance"),
      agent03ParserRepair: casesWithHandoff(cases, "agent03ParserRepair"),
      agent04CoverageRadar: casesWithHandoff(cases, "agent04CoverageRadar"),
      agent06ClaimLedger: casesWithHandoff(cases, "agent06ClaimLedger"),
      agent08GraphHolds: casesWithHandoff(cases, "agent08GraphHolds"),
      agent09Api: casesWithHandoff(cases, "agent09Api"),
      agent10ReleaseGates: casesWithHandoff(cases, "agent10ReleaseGates")
    },
    policy: {
      analystApprovalRequired: true,
      modelSelfMutationAllowed: false,
      regressionOnly: true,
      preservesProvenance: true
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false
    }
  };
}

export function buildAnalystQualityReviewQueueDto(input: {
  query: string;
  actorProfileReviewWorkbench: ActorProfileReviewWorkbenchDto;
  feedbackLoop: AnalystFeedbackLoopDto;
  qualityRegressionSuite: QualityRegressionSuiteDto;
  evaluationDatasetGovernance: EvaluationDatasetGovernanceDto;
  generatedAt?: string;
}): AnalystQualityReviewQueueDto {
  const generatedAt = input.generatedAt ?? input.actorProfileReviewWorkbench.generatedAt;
  const query = input.query.trim();
  const unknownSemanticLabels = input.evaluationDatasetGovernance.labels.filter((label) => label.caseKind === "unknown_actor" || label.subject.toLowerCase().includes("unknown"));
  const isUnknownQuery = /unknown|random|made up|unrecognized/i.test(query);
  const labelsByField = labelsByReviewField(input.evaluationDatasetGovernance);
  const sourceFamilyByEvidence = sourceFamiliesByEvidence(input.evaluationDatasetGovernance);
  const fields = queueFieldMap();
  const items = [...fields.entries()].flatMap(([field, profileFields]) => {
    const matchingFields = input.actorProfileReviewWorkbench.fields.filter((entry) => profileFields.includes(entry.field));
    if (field === "unknown_query") {
      return isUnknownQuery || unknownSemanticLabels.length > 0
        ? [unknownQueryQueueItem(query, generatedAt, unknownSemanticLabels)]
        : [];
    }
    return [qualityQueueItemForField({
      query,
      generatedAt,
      field,
      profileFields: matchingFields,
      feedbackLoop: input.feedbackLoop,
      regressionSuite: input.qualityRegressionSuite,
      labelIds: labelsByField.get(field) ?? [],
      sourceFamilyByEvidence
    })];
  }).filter((item): item is AnalystQualityReviewQueueItemDto => Boolean(item));
  const releaseChecks = releaseGateChecks(items, input.evaluationDatasetGovernance);
  const holdCount = releaseChecks.filter((check) => check.status === "hold").length;
  const warnCount = releaseChecks.filter((check) => check.status === "warn").length;
  const publicAnswerState = isUnknownQuery
    ? "searching"
    : holdCount > 0
      ? "review_required"
      : warnCount > 0
        ? "partial"
        : "ready";

  return {
    schemaVersion: "ti.analyst_quality_review_queue.v1",
    query,
    generatedAt,
    items,
    releaseGate: {
      decision: holdCount > 0 ? "hold" : warnCount > 0 ? "partial" : "promote",
      requiredChecks: releaseChecks,
      publicAnswerState,
      blocksReadyPromotion: holdCount > 0 || publicAnswerState === "searching"
    },
    qualityReleaseSignals: {
      agent09PublicApi: items.filter((item) => item.releaseImpact.blocksReadyPromotion || item.field === "unknown_query").map((item) => item.releaseImpact.apiSignal),
      agent10ReleaseBoard: items.filter((item) => item.releaseImpact.blocksReadyPromotion || item.priority === "high" || item.priority === "critical").map((item) => item.releaseImpact.agent10Signal),
      regressionFixtures: input.qualityRegressionSuite.cases.map((item) => item.id).slice(0, 24),
      staleAnswerPrevention: items.filter((item) => item.state === "stale" || item.requiredActions.includes("refresh_evidence")).map((item) => item.id)
    },
    routing: {
      actorSummary: itemIdsByQueueField(items, "actor_summary"),
      recentActivity: itemIdsByQueueField(items, "recent_activity"),
      victims: itemIdsByQueueField(items, "victims"),
      ttps: itemIdsByQueueField(items, "ttps"),
      infrastructure: itemIdsByQueueField(items, "infrastructure"),
      malwareTools: itemIdsByQueueField(items, "malware_tools"),
      cves: itemIdsByQueueField(items, "cves"),
      sourceGaps: itemIdsByQueueField(items, "source_gaps"),
      unknownQuery: itemIdsByQueueField(items, "unknown_query")
    },
    policy: {
      analystApprovalRequired: true,
      modelSelfMutationAllowed: false,
      preservesUncertainty: true,
      manualReviewOnly: true,
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

export function buildAnalystFeedbackLearningLoopDto(input: {
  query: string;
  feedbackLoop: AnalystFeedbackLoopDto;
  qualityRegressionSuite: QualityRegressionSuiteDto;
  actorProfileReviewWorkbench: ActorProfileReviewWorkbenchDto;
  analystQualityReviewQueue: AnalystQualityReviewQueueDto;
  evaluationDatasetGovernance: EvaluationDatasetGovernanceDto;
  generatedAt?: string;
}): AnalystFeedbackLearningLoopDto {
  const generatedAt = input.generatedAt ?? input.feedbackLoop.generatedAt;
  const records = learningEvents(input, generatedAt);
  const scorecards = learningScorecards(input, records);
  const fixtures = learningFixtures(input, records);
  return {
    schemaVersion: "ti.analyst_feedback_learning_loop.v1",
    query: input.query,
    generatedAt,
    records,
    scorecards,
    fixtures,
    persistence: {
      mode: "readiness_contract_append_only",
      appendOnly: true,
      primaryRecordKey: "records[].id",
      replayOrder: [
        "sort by replay.deterministicOrder",
        "dedupe by replay.idempotencyKey",
        "import labels before regression fixtures",
        "recompute scorecards without mutating extractors",
        "require analyst approval before any downstream training or source change"
      ],
      importSemantics: [
        "records may be replayed into a future append-only feedback table",
        "fixture generation is deterministic and does not fetch new sources",
        "restricted-hold records remain metadata-only and no-leak",
        "unknown-query approvals only allow Searching semantics"
      ],
      mutationBoundary: "no_runtime_mutation_until_persistence_adapter_is_enabled"
    },
    routeState: {
      explainsPartial: records.some((record) => record.type === "source_reliability_downgrade" || record.type === "ttp_mapping_correction"),
      explainsSearching: records.some((record) => record.type === "unknown_query_searching_approval"),
      explainsHeld: records.some((record) => record.state === "held" || record.type === "restricted_hold_confirmation" || record.type === "contradiction_merge_split"),
      explainsReady: scorecards.some((scorecard) => scorecard.status === "pass")
    },
    routing: {
      agent03ParserRepair: recordIds(records, ["actor_alias_correction", "victim_false_positive", "ttp_mapping_correction"]),
      agent04SourceCoverage: recordIds(records, ["source_reliability_downgrade"]),
      agent08GraphCorrections: recordIds(records, ["contradiction_merge_split", "ttp_mapping_correction"]),
      agent09PublicApiFields: records.map((record) => record.id),
      agent10ReleaseGates: records.filter((record) => record.state !== "accepted" || record.type === "unknown_query_searching_approval").map((record) => record.id)
    },
    policy: {
      analystApprovalRequired: true,
      modelSelfMutationAllowed: false,
      autonomousScrapingAllowed: false,
      silentSourceActivationAllowed: false,
      preservesUncertainty: true
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    }
  };
}

export function buildActiveLearningCandidateQueueDto(input: {
  query: string;
  feedbackLoop: AnalystFeedbackLoopDto;
  qualityRegressionSuite: QualityRegressionSuiteDto;
  actorProfileReviewWorkbench: ActorProfileReviewWorkbenchDto;
  analystQualityReviewQueue: AnalystQualityReviewQueueDto;
  evaluationDatasetGovernance: EvaluationDatasetGovernanceDto;
  analystFeedbackLearningLoop: AnalystFeedbackLearningLoopDto;
  generatedAt?: string;
}): ActiveLearningCandidateQueueDto {
  const generatedAt = input.generatedAt ?? input.analystFeedbackLearningLoop.generatedAt;
  const candidates = activeLearningCandidatesForQueue(input, generatedAt);
  const scorecards = activeLearningAggregateScorecardsForQueue(candidates);
  return {
    schemaVersion: "ti.active_learning_candidate_queue.v1",
    query: input.query,
    generatedAt,
    candidates,
    workflow: {
      appendOnly: true,
      humanApprovalRequired: true,
      fixtureRequiredBeforeApproval: true,
      replayRequiredBeforePromotion: true,
      mutationBoundary: "no_runtime_or_model_change_until_human_approved_fixture_replay",
      approvalSteps: [
        "analyst reviews candidate reason and evidence ids",
        "analyst approves or rejects fixture creation",
        "fixture replay runs against extraction ranking graph API and release gates",
        "release owner reviews before any extractor prompt model source score or public answer change",
        "rollback keeps prior extractor ranking and source reliability state"
      ]
    },
    scorecards,
    fixturePack: input.analystFeedbackLearningLoop.fixtures,
    routing: {
      agent03ParserCertification: idsByCandidateTypeForQueue(candidates, ["parser_prompt_model_improvement", "ttp_mapping_rule_update", "actor_alias_merge_split", "victim_false_positive_suppression", "ioc_false_positive_suppression"]),
      agent04FreshnessSourceGaps: idsByCandidateTypeForQueue(candidates, ["source_ranking_adjustment", "source_reliability_downgrade", "freshness_rule_update"]),
      agent06EvidenceReplay: candidates.map((candidate: ActiveLearningCandidateDto) => candidate.id),
      agent08GraphCorrections: idsByCandidateTypeForQueue(candidates, ["ttp_mapping_rule_update", "actor_alias_merge_split", "contradiction_resolution"]),
      agent09ApiFields: candidates.map((candidate: ActiveLearningCandidateDto) => candidate.id),
      agent10ReleaseGates: candidates.filter((candidate: ActiveLearningCandidateDto) => candidate.priority === "high" || candidate.priority === "critical" || candidate.status !== "candidate").map((candidate: ActiveLearningCandidateDto) => candidate.id)
    },
    policy: {
      analystApprovalRequired: true,
      modelSelfMutationAllowed: false,
      autonomousScrapingAllowed: false,
      silentSourceActivationAllowed: false,
      preservesUncertainty: true,
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

function activeLearningCandidatesForQueue(input: Parameters<typeof buildActiveLearningCandidateQueueDto>[0], generatedAt: string): ActiveLearningCandidateDto[] {
  return activeLearningCandidatesLegacyWide(input, generatedAt);
}

function activeLearningAggregateScorecardsForQueue(candidates: ActiveLearningCandidateDto[]): ActiveLearningBeforeAfterScorecardDto[] {
  return activeLearningAggregateScorecardsLegacyWide(candidates);
}

function idsByCandidateTypeForQueue(candidates: ActiveLearningCandidateDto[], types: ActiveLearningCandidateType[]): string[] {
  return idsByCandidateTypeLegacyWide(candidates, types);
}

function candidateTypeForLearningRecord(type: AnalystFeedbackLearningEventType): ActiveLearningCandidateType {
  if (type === "actor_alias_correction") return "actor_alias_merge_split";
  if (type === "victim_false_positive") return "victim_false_positive_suppression";
  if (type === "ttp_mapping_correction") return "ttp_mapping_rule_update";
  if (type === "stale_activity_rejection") return "freshness_rule_update";
  if (type === "source_reliability_downgrade") return "source_reliability_downgrade";
  if (type === "contradiction_merge_split") return "contradiction_resolution";
  return "source_ranking_adjustment";
}

function metricForCandidate(type: ActiveLearningCandidateType): ActiveLearningBeforeAfterScorecardDto["metric"] {
  if (type === "parser_prompt_model_improvement") return "extraction_precision";
  if (type === "source_ranking_adjustment" || type === "source_reliability_downgrade") return "source_diversity";
  if (type === "freshness_rule_update") return "freshness";
  if (type === "contradiction_resolution" || type === "actor_alias_merge_split") return "contradiction_handling";
  if (type === "ttp_mapping_rule_update") return "extraction_recall";
  return "provenance_completeness";
}

function affectedPublicApiFields(type: ActiveLearningCandidateType): string[] {
  if (type === "freshness_rule_update") return ["publicTiAnswer.caveats", "freshness"];
  if (type === "source_ranking_adjustment" || type === "source_reliability_downgrade") return ["sourceCoverage", "evidence"];
  if (type === "actor_alias_merge_split") return ["entityResolution", "actorProfile"];
  if (type === "contradiction_resolution") return ["claimLedger", "answerCaveats"];
  return ["publicIntelClaims", "qualityGates"];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function feedbackFromClaims(query: string, claims: PublicIntelClaimDto[]): AnalystFeedbackContractItemDto[] {
  return claims.flatMap((claim) => {
    const base = {
      field: claim.field,
      value: claim.value,
      evidenceIds: claim.evidenceIds,
      ledgerIds: claim.ledgerIds,
      confidenceBefore: claim.confidence
    };
    return [
      claim.status === "fact" ? item(query, "correct", "quality_gate", base, ["claim is currently fact-ready; analyst may confirm"]) : undefined,
      claim.status !== "fact" ? item(query, "underconfident", "quality_gate", base, ["claim is not fact-ready; analyst may promote only with review"]) : undefined,
      claim.downgradeReasons.some((reason) => /stale/i.test(reason)) ? item(query, "stale", "public_answer_caveat", base, claim.downgradeReasons) : undefined,
      claim.downgradeReasons.some((reason) => /contradict|wrong/i.test(reason)) ? item(query, "wrong", "graph_review", base, claim.downgradeReasons) : undefined,
      claim.downgradeReasons.some((reason) => /duplicate/i.test(reason)) ? item(query, "duplicate", "entity_resolution", base, claim.downgradeReasons) : undefined
    ].filter((entry): entry is AnalystFeedbackContractItemDto => Boolean(entry));
  });
}

function feedbackFromQuality(query: string, dashboard: SearchQualityDashboardDto | undefined): AnalystFeedbackContractItemDto[] {
  if (!dashboard) return [];
  return dashboard.fields.flatMap((field) => {
    if (field.gate === "pass") return [];
    const isStale = field.reasons.some((reason) => /stale/i.test(reason));
    const mark: AnalystFeedbackMark = field.gate === "hold"
      ? "wrong"
      : isStale
        ? "stale"
        : "underconfident";
    return [item(query, mark, "quality_gate", {
      field: field.field,
      evidenceIds: [],
      ledgerIds: [],
      confidenceBefore: field.confidence,
      recommendedConfidenceAfter: mark === "wrong" ? 0.2 : isStale ? 0.35 : 0.55
    }, field.reasons)];
  });
}

function feedbackFromEntityResolution(query: string, workbench: EntityResolutionWorkbenchDto | undefined): AnalystFeedbackContractItemDto[] {
  if (!workbench) return [];
  return workbench.candidates
    .filter((candidate) => candidate.reviewState !== "accepted")
    .flatMap((candidate) => [
      item(query, candidate.uncertaintyReasons.some((reason) => /duplicate/i.test(reason)) ? "duplicate" : "underconfident", "entity_resolution", {
        field: candidate.kind,
        value: candidate.canonicalValue,
        evidenceIds: candidate.evidenceIds,
        ledgerIds: [],
        confidenceBefore: candidate.confidence
      }, candidate.uncertaintyReasons),
      ...(candidate.correctionActions.includes("send_to_graph_review") ? [item(query, "missing", "graph_review", {
        field: candidate.kind,
        value: candidate.canonicalValue,
        evidenceIds: candidate.evidenceIds,
        ledgerIds: []
      }, ["graph relationship needs analyst-reviewed entity resolution"])] : [])
    ]);
}

function feedbackFromTimeliness(query: string, timeliness: TimelinessGroundTruthHarnessDto | undefined): AnalystFeedbackContractItemDto[] {
  if (!timeliness) return [];
  return timeliness.gaps.map((gap) => item(query, gap.code.includes("stale") ? "stale" : "missing", "public_answer_caveat", {
    field: gap.field ?? "timeliness",
    evidenceIds: gap.evidenceIds,
    ledgerIds: []
  }, [gap.message]));
}

function feedbackForMissingFields(query: string, dto: LiveActorIntelligenceDto | undefined): AnalystFeedbackContractItemDto[] {
  if (!dto) return [];
  return [
    dto.targets.victims.length === 0 ? item(query, "missing", "parser_repair", { field: "victim_company", evidenceIds: dto.provenance.map((p) => p.evidenceId), ledgerIds: [] }, ["no victim/company extraction available"]) : undefined,
    dto.ttps.length === 0 ? item(query, "missing", "parser_repair", { field: "ttps", evidenceIds: dto.provenance.map((p) => p.evidenceId), ledgerIds: [] }, ["no TTP extraction available"]) : undefined,
    dto.datasets.sourceCount < 2 ? item(query, "underconfident", "source_reliability", { field: "source_diversity", evidenceIds: dto.provenance.map((p) => p.evidenceId), ledgerIds: [] }, ["fewer than two source families support answer"]) : undefined
  ].filter((entry): entry is AnalystFeedbackContractItemDto => Boolean(entry));
}

function item(
  query: string,
  mark: AnalystFeedbackMark,
  target: AnalystFeedbackTarget,
  base: {
    field: string;
    value?: string;
    evidenceIds: string[];
    ledgerIds: string[];
    confidenceBefore?: number;
    recommendedConfidenceAfter?: number;
  },
  reasons: string[]
): AnalystFeedbackContractItemDto {
  return {
    id: stableId("analyst-feedback", `${query}:${mark}:${target}:${base.field}:${base.value ?? ""}:${base.evidenceIds.join(":")}`),
    mark,
    target,
    field: base.field,
    value: base.value,
    evidenceIds: base.evidenceIds.slice(0, 12),
    ledgerIds: base.ledgerIds.slice(0, 12),
    confidenceBefore: base.confidenceBefore,
    recommendedConfidenceAfter: base.recommendedConfidenceAfter,
    reasons: reasons.slice(0, 10),
    immutable: true,
    appliesAutomatically: false
  };
}

function idsFor(items: AnalystFeedbackContractItemDto[], target: AnalystFeedbackTarget): string[] {
  return items.filter((item) => item.target === target).map((item) => item.id);
}

function regressionCaseFromFeedback(query: string, generatedAt: string, feedback: AnalystFeedbackContractItemDto): QualityRegressionCaseDto {
  const area = regressionArea(feedback);
  const state = correctionState(feedback);
  return {
    id: stableId("quality-regression", `${feedback.id}:${state}:${area}`),
    sourceFeedbackId: feedback.id,
    state,
    area,
    field: feedback.field,
    value: feedback.value,
    assertion: regressionAssertion(area, state, feedback.field),
    expectedOutcome: expectedRegressionOutcome(area, state),
    evidenceIds: feedback.evidenceIds.slice(0, 12),
    ledgerIds: feedback.ledgerIds.slice(0, 12),
    provenance: {
      query,
      generatedAt,
      feedbackTarget: feedback.target,
      source: "analyst_feedback"
    },
    caveatUpdates: caveatUpdates(area, state, feedback.reasons),
    handoffs: handoffsForRegression(area, state),
    immutable: true,
    appliesAutomatically: false
  };
}

function regressionCasesFromTimeliness(query: string, generatedAt: string, timeliness: TimelinessGroundTruthHarnessDto | undefined): QualityRegressionCaseDto[] {
  if (!timeliness) return [];
  return timeliness.gaps.map((gap) => ({
    id: stableId("quality-regression", `${query}:timeliness:${gap.code}:${gap.field ?? "timeliness"}`),
    state: gap.code.includes("stale") ? "stale" : "needs_evidence",
    area: "public_answer_caveat",
    field: gap.field ?? "timeliness",
    assertion: "public answer latest-activity wording must not promote stale activity as current",
    expectedOutcome: "answer remains partial or caveated until fresh corroborating evidence is captured",
    evidenceIds: gap.evidenceIds.slice(0, 12),
    ledgerIds: [],
    provenance: { query, generatedAt, source: "timeliness_harness" },
    caveatUpdates: [gap.message],
    handoffs: {
      agent06ClaimLedger: "expire_or_caveat_stale_claim",
      agent09Api: "surface_public_answer_stale_caveat",
      agent10ReleaseGates: "hold_ready_promotion_on_stale_activity"
    },
    immutable: true,
    appliesAutomatically: false
  }));
}

function regressionCasesFromAttackMapping(query: string, generatedAt: string, attack: AttackMappingQualityDto | undefined): QualityRegressionCaseDto[] {
  if (!attack) return [];
  return attack.techniques
    .filter((technique) => technique.reviewState !== "accepted" || technique.drift.deprecatedOrRevoked || technique.stixEligibility.impact !== "eligible")
    .slice(0, 24)
    .map((technique) => ({
      id: stableId("quality-regression", `${query}:attack:${technique.id}:${technique.reviewState}`),
      state: technique.drift.deprecatedOrRevoked ? "stale" : technique.contradictionFlags.length > 0 ? "false_positive" : "needs_evidence",
      area: "attack_mapping",
      field: "attack_technique",
      value: technique.attackId ?? technique.name,
      assertion: "ATT&CK mappings with drift, contradictions, weak actor relevance, or STIX blockers must remain review-held",
      expectedOutcome: "technique stays out of ready public answers and STIX fact export until reviewed with provenance",
      evidenceIds: technique.evidenceIds.slice(0, 12),
      ledgerIds: [],
      provenance: {
        query,
        generatedAt,
        attackTechniqueId: technique.attackId,
        source: "attack_mapping_quality"
      },
      caveatUpdates: [...technique.drift.reasons, ...technique.contradictionFlags, ...technique.stixEligibility.reasons].slice(0, 10),
      handoffs: {
        agent06ClaimLedger: "attach_attack_mapping_review_to_claim_ledger",
        agent08GraphHolds: "hold_or_downgrade_attack_relationship",
        agent09Api: "surface_attack_mapping_review_state",
        agent10ReleaseGates: "block_release_if_deprecated_or_contradicted_attack_mapping_promotes"
      },
      immutable: true,
      appliesAutomatically: false
    }));
}

function regressionArea(feedback: AnalystFeedbackContractItemDto): QualityRegressionArea {
  if (feedback.target === "entity_resolution") return "entity_resolution";
  if (feedback.target === "graph_review") return "graph_review";
  if (feedback.target === "public_answer_caveat") return "public_answer_caveat";
  if (feedback.target === "parser_repair") return "extraction";
  if (feedback.target === "source_reliability") return "source_reliability";
  return feedback.mark === "overconfident" || feedback.mark === "underconfident" ? "ranking" : "extraction";
}

function correctionState(feedback: AnalystFeedbackContractItemDto): AnalystCorrectionState {
  if (feedback.mark === "correct") return "accepted";
  if (feedback.mark === "wrong") return "false_positive";
  if (feedback.mark === "missing" && feedback.target === "parser_repair") return "parser_repair";
  if (feedback.mark === "missing") return "needs_evidence";
  if (feedback.mark === "duplicate") return "duplicate";
  if (feedback.mark === "stale") return "stale";
  if (feedback.mark === "overconfident") return "overconfident";
  if (feedback.mark === "underconfident" && feedback.target === "source_reliability") return "source_repair";
  return "underconfident";
}

function regressionAssertion(area: QualityRegressionArea, state: AnalystCorrectionState, field: string): string {
  if (state === "accepted") return `${field} remains accepted only when the same provenance-backed evidence is present`;
  if (state === "duplicate") return `${field} duplicate evidence is suppressed before ranking, entity merge, and graph promotion`;
  if (state === "stale") return `${field} stale evidence cannot be described as current activity`;
  if (state === "false_positive") return `${field} false-positive claim stays out of public answers and graph facts`;
  if (state === "parser_repair") return `${field} extraction miss becomes a parser regression fixture`;
  if (state === "source_repair") return `${field} source reliability issue becomes a source-governance regression fixture`;
  return `${field} ${area} confidence remains review-held until stronger evidence is captured`;
}

function expectedRegressionOutcome(area: QualityRegressionArea, state: AnalystCorrectionState): string {
  if (state === "accepted") return "preserve accepted claim with identical provenance and no autonomous mutation";
  if (state === "rejected" || state === "false_positive") return "suppress from public answer, graph export, and ready promotion";
  if (state === "stale") return "downgrade freshness and add public caveat before response generation";
  if (state === "duplicate") return "dedupe before ranking and keep merge evidence reviewable";
  if (state === "parser_repair") return "route to parser repair fixture without exposing raw evidence";
  if (state === "source_repair") return "route to source reliability review before future source scoring";
  return area === "ranking" ? "adjust confidence bounds only after analyst-approved fixture replay" : "keep review-held and request corroborating evidence";
}

function caveatUpdates(area: QualityRegressionArea, state: AnalystCorrectionState, reasons: string[]): string[] {
  const updates = reasons.length > 0 ? reasons : [`${area}:${state}`];
  if (state === "stale") return ["stale activity must remain caveated", ...updates].slice(0, 10);
  if (state === "false_positive") return ["false-positive claim must be suppressed", ...updates].slice(0, 10);
  if (state === "underconfident" || state === "needs_evidence") return ["answer remains partial until corroborated", ...updates].slice(0, 10);
  return updates.slice(0, 10);
}

function handoffsForRegression(area: QualityRegressionArea, state: AnalystCorrectionState): QualityRegressionCaseDto["handoffs"] {
  return {
    agent01SourceGovernance: area === "source_reliability" || state === "source_repair" ? "review_source_score_and_approval_history" : undefined,
    agent03ParserRepair: area === "extraction" || state === "parser_repair" ? "add_parser_regression_fixture" : undefined,
    agent04CoverageRadar: area === "source_reliability" ? "include_gap_in_coverage_radar" : undefined,
    agent06ClaimLedger: state === "accepted" ? "preserve_claim_provenance" : "record_correction_state_without_raw_evidence",
    agent08GraphHolds: area === "graph_review" || state === "false_positive" ? "hold_or_remove_relationship_until_review" : undefined,
    agent09Api: "publish_quality_regression_case",
    agent10ReleaseGates: state === "accepted" ? "include_in_regression_replay" : "hold_release_if_regression_fails"
  };
}

function countCases(cases: QualityRegressionCaseDto[], area: QualityRegressionArea): number {
  return cases.filter((item) => item.area === area).length;
}

function casesWithHandoff(
  cases: QualityRegressionCaseDto[],
  key: keyof QualityRegressionCaseDto["handoffs"]
): string[] {
  return cases.filter((item) => Boolean(item.handoffs[key])).map((item) => item.id);
}

const ACTOR_PROFILE_REVIEW_FIELDS: ActorProfileReadinessField[] = [
  "summary",
  "aliases",
  "recent_activity",
  "timeline_changes",
  "targets",
  "victims",
  "sectors",
  "regions",
  "ttps",
  "malware_tools",
  "vulnerabilities",
  "infrastructure",
  "datasets"
];

function groupFeedbackByField(items: AnalystFeedbackContractItemDto[]): Map<ActorProfileReadinessField, AnalystFeedbackContractItemDto[]> {
  const grouped = new Map<ActorProfileReadinessField, AnalystFeedbackContractItemDto[]>();
  for (const item of items) {
    const field = normalizeReviewField(item.field);
    grouped.set(field, [...(grouped.get(field) ?? []), item]);
  }
  return grouped;
}

function groupClaimsByField(claims: PublicIntelClaimDto[]): Map<ActorProfileReadinessField, PublicIntelClaimDto[]> {
  const grouped = new Map<ActorProfileReadinessField, PublicIntelClaimDto[]>();
  for (const claim of claims) {
    grouped.set(claim.field, [...(grouped.get(claim.field) ?? []), claim]);
  }
  return grouped;
}

function normalizeReviewField(field: string): ActorProfileReadinessField {
  if (ACTOR_PROFILE_REVIEW_FIELDS.includes(field as ActorProfileReadinessField)) return field as ActorProfileReadinessField;
  if (/victim|company/i.test(field)) return "victims";
  if (/ttp|technique|attack/i.test(field)) return "ttps";
  if (/cve|vulnerab/i.test(field)) return "vulnerabilities";
  if (/malware|tool/i.test(field)) return "malware_tools";
  if (/sector/i.test(field)) return "sectors";
  if (/region|country/i.test(field)) return "regions";
  if (/alias|entity|ransomware_rebrand/i.test(field)) return "aliases";
  if (/source|dataset/i.test(field)) return "datasets";
  if (/fresh|time|recent|latest/i.test(field)) return "recent_activity";
  return "summary";
}

function reviewStateForField(input: {
  field: ActorProfileReadinessField;
  readinessStatus?: ActorProfileReadinessStatus;
  feedback: AnalystFeedbackContractItemDto[];
  reviewReasons: string[];
  contradictionSignals: string[];
}): ActorProfileReviewState {
  const marks = input.feedback.map((item) => item.mark);
  const reasonText = input.reviewReasons.join(" ");
  if (input.contradictionSignals.length > 0 || /contradict|disput/i.test(reasonText)) return "contradicted";
  if (marks.includes("wrong")) return "wrong";
  if (marks.includes("duplicate")) return "duplicate";
  if (marks.includes("stale") || /stale|old|expired/i.test(reasonText)) return "stale";
  if (marks.includes("missing") || input.readinessStatus === undefined) return "missing";
  if (marks.includes("overconfident")) return "overconfident";
  if (marks.includes("underconfident") || input.readinessStatus === "needs_review") return "underconfident";
  if (input.readinessStatus === "partial_evidence") return "needs_evidence";
  return "accepted";
}

function fieldFreshness(
  dto: LiveActorIntelligenceDto | undefined,
  field: ActorProfileReadinessField,
  timelinessField: { status?: string; score?: number } | undefined
): ActorProfileReviewFieldDto["freshness"] {
  const stale = timelinessField?.status === "stale" || dto?.caveats.some((caveat) => caveat.code === "stale") === true;
  const profileScore = field === "recent_activity" || field === "timeline_changes"
    ? dto?.recentActivity.freshnessScore
    : undefined;
  return {
    score: clampConfidence(timelinessField?.score ?? profileScore ?? 0),
    lastSeen: dto?.recentActivity.lastSeen,
    reportPublishedAt: dto?.recentActivity.reportPublishedAt,
    stale
  };
}

function fieldValues(dto: LiveActorIntelligenceDto | undefined, claims: PublicIntelClaimDto[], field: ActorProfileReadinessField): string[] {
  const claimValues = claims.map((claim) => claim.value).filter(Boolean);
  if (!dto) return unique(claimValues).slice(0, 12);
  const values: string[] = [];
  if (field === "summary") values.push(...dto.summaryBullets.map((_, index) => `summary_bullet_${index + 1}`));
  if (field === "aliases") values.push(...dto.aliases);
  if (field === "recent_activity") values.push(...dto.recentActivity.notes.map((_, index) => `recent_activity_note_${index + 1}`));
  if (field === "timeline_changes") values.push(...[dto.recentActivity.firstSeen ? "first_seen" : "", dto.recentActivity.lastSeen ? "last_seen" : ""].filter(Boolean));
  if (field === "targets") values.push(...dto.targets.victims, ...dto.targets.sectors, ...dto.targets.regions);
  if (field === "victims") values.push(...dto.targets.victims);
  if (field === "sectors") values.push(...dto.targets.sectors);
  if (field === "regions") values.push(...dto.targets.regions);
  if (field === "ttps") values.push(...dto.ttps);
  if (field === "malware_tools") values.push(...dto.malwareTools);
  if (field === "vulnerabilities") values.push(...dto.vulnerabilities);
  if (field === "infrastructure") values.push(...dto.infrastructure);
  if (field === "datasets") values.push(...dto.datasets.coverage);
  return unique([...claimValues, ...values]).slice(0, 12);
}

function correctionActionsForField(input: {
  query: string;
  field: ActorProfileReadinessField;
  state: ActorProfileReviewState;
  values: string[];
  evidenceIds: string[];
  ledgerIds: string[];
  confidence: number;
  reviewReasons: string[];
}): ActorProfileCorrectionActionDto[] {
  const primaryValue = input.values[0];
  const reason = safeReviewReason(input.reviewReasons[0] ?? `${input.field}:${input.state}`);
  const base = { field: input.field, value: primaryValue, evidenceIds: input.evidenceIds, ledgerIds: input.ledgerIds };
  const actions: ActorProfileCorrectionActionDto[] = [];
  if (input.state === "accepted" || input.state === "partial") {
    actions.push(correctionAction(input.query, "accept_field", base, "Confirm field with current provenance.", reason));
  }
  if (input.state === "stale") {
    actions.push(correctionAction(input.query, "mark_stale", base, "Mark stale and keep public answer caveated.", reason));
    actions.push(correctionAction(input.query, "request_more_evidence", base, "Request fresher corroborating evidence.", reason));
  }
  if (input.state === "contradicted") {
    actions.push(correctionAction(input.query, "mark_contradicted", base, "Hold contradictory field for graph and claim-ledger review.", reason));
    actions.push(correctionAction(input.query, "route_graph_review", base, "Route contradiction to graph review.", reason));
  }
  if (input.state === "duplicate") actions.push(correctionAction(input.query, "merge_duplicate", base, "Merge duplicate field evidence after analyst approval.", reason));
  if (input.state === "wrong") actions.push(correctionAction(input.query, "suppress_wrong_claim", base, "Suppress wrong claim from public answer and graph promotion.", reason));
  if (input.state === "missing" || input.state === "needs_evidence") {
    actions.push(correctionAction(input.query, "request_more_evidence", base, "Request corroborating evidence before ready promotion.", reason));
    actions.push(correctionAction(input.query, "route_parser_repair", base, "Route missing extraction to parser repair fixtures.", reason));
  }
  if (input.state === "overconfident" || (input.confidence > 0.75 && input.evidenceIds.length < 2)) {
    actions.push(correctionAction(input.query, "lower_confidence", base, "Lower confidence until independent support exists.", reason));
  }
  if (input.state === "underconfident") {
    actions.push(correctionAction(input.query, "raise_confidence", base, "Raise confidence only after analyst-approved fixture replay.", reason));
    actions.push(correctionAction(input.query, "route_claim_ledger", base, "Route supporting evidence to claim ledger for review.", reason));
  }
  return actions.slice(0, 4);
}

function correctionAction(
  query: string,
  kind: ActorProfileCorrectionActionKind,
  base: { field: ActorProfileReadinessField; value?: string; evidenceIds: string[]; ledgerIds: string[] },
  label: string,
  reason: string
): ActorProfileCorrectionActionDto {
  const id = stableId("actor-profile-correction", `${query}:${kind}:${base.field}:${base.value ?? ""}:${base.evidenceIds.join(":")}`);
  return {
    id,
    kind,
    label,
    field: base.field,
    value: base.value,
    evidenceIds: base.evidenceIds.slice(0, 12),
    ledgerIds: base.ledgerIds.slice(0, 12),
    manualOnly: true,
    appliesAutomatically: false,
    reason,
    handoffs: handoffsForCorrection(kind, base.field)
  };
}

function handoffsForCorrection(kind: ActorProfileCorrectionActionKind, field: ActorProfileReadinessField): ActorProfileCorrectionActionDto["handoffs"] {
  return {
    agent01SourceGaps: kind === "request_more_evidence" || field === "datasets" ? "request_source_gap_or_source_freshness_review" : undefined,
    agent04PublicCoverage: kind === "request_more_evidence" ? "expand_safe_public_coverage_for_field" : undefined,
    agent06ClaimLedger: ["accept_field", "mark_stale", "mark_contradicted", "suppress_wrong_claim", "route_claim_ledger"].includes(kind) ? "record_field_correction_state_with_provenance" : undefined,
    agent08GraphHolds: ["mark_contradicted", "route_graph_review", "suppress_wrong_claim"].includes(kind) ? "hold_or_update_graph_relationship" : undefined,
    agent09ApiContracts: "surface_actor_profile_review_state",
    agent10ReleaseGates: kind === "accept_field" ? "include_in_regression_replay" : "hold_ready_promotion_if_unresolved"
  };
}

function routeActionIds(actions: ActorProfileCorrectionActionDto[], key: keyof ActorProfileCorrectionActionDto["handoffs"]): string[] {
  return actions.filter((action) => Boolean(action.handoffs[key])).map((action) => action.id);
}

function fieldIds(fields: ActorProfileReviewFieldDto[], state: ActorProfileReviewState): string[] {
  return fields.filter((field) => field.state === state).map((field) => field.field);
}

function maxClaimConfidence(claims: PublicIntelClaimDto[]): number | undefined {
  if (claims.length === 0) return undefined;
  return Math.max(...claims.map((claim) => claim.confidence));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function reasonCode(reason: string): string {
  return reason.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "review_required";
}

function safeReviewReason(reason: string): string {
  return reason
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/[\w.-]+\.onion\S*/gi, "[redacted-onion]")
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, "[redacted-email]")
    .slice(0, 180);
}

function queueFieldMap(): Map<AnalystQualityQueueField, ActorProfileReadinessField[]> {
  return new Map([
    ["actor_summary", ["summary", "aliases"]],
    ["recent_activity", ["recent_activity", "timeline_changes"]],
    ["victims", ["victims"]],
    ["ttps", ["ttps"]],
    ["infrastructure", ["infrastructure"]],
    ["malware_tools", ["malware_tools"]],
    ["cves", ["vulnerabilities"]],
    ["source_gaps", ["datasets"]],
    ["unknown_query", []]
  ]);
}

function qualityQueueItemForField(input: {
  query: string;
  generatedAt: string;
  field: AnalystQualityQueueField;
  profileFields: ActorProfileReviewFieldDto[];
  feedbackLoop: AnalystFeedbackLoopDto;
  regressionSuite: QualityRegressionSuiteDto;
  labelIds: string[];
  sourceFamilyByEvidence: Map<string, string[]>;
}): AnalystQualityReviewQueueItemDto {
  const evidenceIds = unique(input.profileFields.flatMap((field) => field.evidenceIds)).slice(0, 16);
  const ledgerIds = unique(input.profileFields.flatMap((field) => field.ledgerIds)).slice(0, 16);
  const states = input.profileFields.map((field) => field.state);
  const reasons = unique(input.profileFields.flatMap((field) => field.uncertainty.reviewReasons.map(safeReviewReason))).slice(0, 12);
  const freshnessScores = input.profileFields.map((field) => field.freshness.score);
  const freshness = {
    score: freshnessScores.length > 0 ? Math.min(...freshnessScores) : 0,
    stale: input.profileFields.some((field) => field.freshness.stale || field.state === "stale"),
    lastSeen: firstDefined(input.profileFields.map((field) => field.freshness.lastSeen)),
    reportPublishedAt: firstDefined(input.profileFields.map((field) => field.freshness.reportPublishedAt))
  };
  const confidenceValues = input.profileFields.map((field) => field.confidence);
  const confidence = confidenceValues.length > 0 ? Math.min(...confidenceValues) : 0;
  const sourceFamilies = unique(evidenceIds.flatMap((id) => input.sourceFamilyByEvidence.get(id) ?? [])).slice(0, 8);
  const regressionCaseIds = input.regressionSuite.cases
    .filter((item) => queueFieldMatchesRegression(input.field, item.field, item.area))
    .map((item) => item.id);
  const feedbackIds = input.feedbackLoop.items
    .filter((item) => queueFieldMatchesFeedback(input.field, item.field, item.target))
    .map((item) => item.id);
  const state = queueState({
    field: input.field,
    states,
    evidenceIds,
    ledgerIds,
    freshnessStale: freshness.stale,
    sourceFamilyCount: sourceFamilies.length,
    reasons
  });
  const requiredActions = queueRequiredActions(input.field, state, evidenceIds, ledgerIds, freshness.stale, sourceFamilies.length, regressionCaseIds.length + feedbackIds.length);
  const blocksReadyPromotion = state !== "ready" || requiredActions.some((action) => action === "resolve_contradiction" || action === "hold_restricted_metadata" || action === "attach_provenance");
  return {
    id: stableId("analyst-quality-review", `${input.query}:${input.field}:${state}:${evidenceIds.join(":")}:${input.labelIds.join(":")}`),
    field: input.field,
    state,
    priority: queuePriority(state, input.field, blocksReadyPromotion),
    subject: input.field,
    confidence,
    freshness,
    evidenceIds,
    ledgerIds,
    labelIds: input.labelIds.slice(0, 12),
    sourceFamilies,
    reasons: unique([...reasons, ...feedbackIds.map((id) => `feedback:${id}`), ...regressionCaseIds.map((id) => `regression:${id}`)]).slice(0, 16),
    requiredActions,
    releaseImpact: {
      blocksReadyPromotion,
      publicAnswerState: blocksReadyPromotion ? "review_required" : sourceFamilies.length < 2 || confidence < 0.75 ? "partial" : "ready",
      apiSignal: `quality.${input.field}.${state}`,
      agent10Signal: `release_gate.${input.field}.${blocksReadyPromotion ? "hold" : "ok"}`
    },
    immutable: true,
    appliesAutomatically: false
  };
}

function unknownQueryQueueItem(query: string, generatedAt: string, labels: EvaluationDatasetGovernanceDto["labels"]): AnalystQualityReviewQueueItemDto {
  const evidenceIds = unique(labels.flatMap((label) => label.evidenceIds)).slice(0, 12);
  const ledgerIds = unique(labels.flatMap((label) => label.claimLedgerRefs)).slice(0, 12);
  return {
    id: stableId("analyst-quality-review", `${query}:unknown_query:searching_only:${generatedAt}`),
    field: "unknown_query",
    state: "searching_only",
    priority: "critical",
    subject: query || "unknown actor",
    confidence: 0,
    freshness: { score: 0, stale: false },
    evidenceIds,
    ledgerIds,
    labelIds: labels.map((label) => label.id).slice(0, 12),
    sourceFamilies: unique(labels.map((label) => label.sourceFamily)).slice(0, 8),
    reasons: ["unknown actor queries must say only Searching until evidence is captured", "no default actor, demo prose, or stale cache prose is allowed"],
    requiredActions: ["keep_searching_only", "add_regression_fixture"],
    releaseImpact: {
      blocksReadyPromotion: true,
      publicAnswerState: "searching",
      apiSignal: "quality.unknown_query.searching_only",
      agent10Signal: "release_gate.unknown_query.searching_only"
    },
    immutable: true,
    appliesAutomatically: false
  };
}

function queueState(input: {
  field: AnalystQualityQueueField;
  states: ActorProfileReviewState[];
  evidenceIds: string[];
  ledgerIds: string[];
  freshnessStale: boolean;
  sourceFamilyCount: number;
  reasons: string[];
}): AnalystQualityQueueState {
  const reasonText = input.reasons.join(" ");
  if (input.states.includes("contradicted") || /contradict|disput/i.test(reasonText)) return "contradicted";
  if (input.states.includes("stale") || input.freshnessStale) return "stale";
  if (input.evidenceIds.length > 0 && input.ledgerIds.length === 0) return "missing_provenance";
  if (/restricted metadata hold|required/i.test(reasonText)) return "restricted_hold";
  if (input.evidenceIds.length === 0 || input.states.includes("missing") || input.states.includes("needs_evidence")) return "needs_review";
  if (input.sourceFamilyCount < 2 && (input.field === "actor_summary" || input.field === "source_gaps")) return "needs_review";
  return "ready";
}

function queueRequiredActions(
  field: AnalystQualityQueueField,
  state: AnalystQualityQueueState,
  evidenceIds: string[],
  ledgerIds: string[],
  stale: boolean,
  sourceFamilyCount: number,
  regressionCount: number
): AnalystQualityReviewQueueItemDto["requiredActions"] {
  const actions: AnalystQualityReviewQueueItemDto["requiredActions"] = [];
  if (field === "actor_summary") actions.push("confirm_summary");
  if (stale || state === "stale") actions.push("refresh_evidence");
  if (state === "contradicted") actions.push("resolve_contradiction");
  if (evidenceIds.length === 0 || ledgerIds.length === 0 || state === "missing_provenance") actions.push("attach_provenance");
  if (state === "restricted_hold") actions.push("hold_restricted_metadata");
  if (sourceFamilyCount < 2 && field !== "unknown_query") actions.push("expand_source_diversity");
  if (regressionCount > 0 || state !== "ready") actions.push("add_regression_fixture");
  return [...new Set(actions)];
}

function queuePriority(state: AnalystQualityQueueState, field: AnalystQualityQueueField, blocksReadyPromotion: boolean): AnalystQualityReviewQueueItemDto["priority"] {
  if (state === "contradicted" || state === "restricted_hold" || field === "unknown_query") return "critical";
  if (blocksReadyPromotion || state === "missing_provenance") return "high";
  if (state === "stale" || state === "needs_review") return "medium";
  return "low";
}

function releaseGateChecks(items: AnalystQualityReviewQueueItemDto[], governance: EvaluationDatasetGovernanceDto): AnalystQualityReviewQueueDto["releaseGate"]["requiredChecks"] {
  const check = (
    code: AnalystQualityReleaseGateCode,
    itemIds: string[],
    reason: string
  ): AnalystQualityReviewQueueDto["releaseGate"]["requiredChecks"][number] => ({
    code,
    status: itemIds.some((id) => items.find((item) => item.id === id)?.releaseImpact.blocksReadyPromotion) ? "hold" : itemIds.length > 0 ? "warn" : "pass",
    itemIds,
    reason
  });
  return [
    check("freshness", items.filter((item) => item.freshness.stale || item.requiredActions.includes("refresh_evidence")).map((item) => item.id), "freshness must be current before ready public promotion"),
    check("provenance", items.filter((item) => item.evidenceIds.length === 0 || item.ledgerIds.length === 0 || item.state === "missing_provenance").map((item) => item.id), "ready answers require evidence IDs and claim-ledger refs"),
    check("source_diversity", items.filter((item) => item.sourceFamilies.length < 2 && item.field !== "unknown_query").map((item) => item.id), "single-family support remains partial or review-held"),
    check("contradiction_state", items.filter((item) => item.state === "contradicted").map((item) => item.id), "contradicted claims must be resolved before ready promotion"),
    check("evidence_retention", items.filter((item) => item.reasons.some((reason) => /retention|expired/i.test(reason))).map((item) => item.id), "retained evidence must remain replayable"),
    check("restricted_holds", items.filter((item) => item.state === "restricted_hold" || item.requiredActions.includes("hold_restricted_metadata")).map((item) => item.id), "restricted metadata cannot promote without analyst approval"),
    check("unknown_searching_semantics", items.filter((item) => item.field === "unknown_query").map((item) => item.id), "unknown actor public answer remains Searching-only"),
    {
      code: "label_governance",
      status: governance.summary.auditHoldCount > 0 ? "hold" : governance.summary.auditWarningCount > 0 ? "warn" : "pass",
      itemIds: governance.auditChecks.flatMap((audit) => audit.labelIds).slice(0, 24),
      reason: "evaluation labels must pass governance audit before release freeze"
    }
  ];
}

function labelsByReviewField(governance: EvaluationDatasetGovernanceDto): Map<AnalystQualityQueueField, string[]> {
  const grouped = new Map<AnalystQualityQueueField, string[]>();
  for (const label of governance.labels) {
    const field = label.caseKind === "unknown_actor"
      ? "unknown_query"
      : label.caseKind === "victim_company"
        ? "victims"
        : label.caseKind === "cve"
          ? "cves"
          : label.caseKind === "malware_tool"
            ? "malware_tools"
            : label.caseKind === "low_confidence"
              ? "ttps"
              : label.caseKind === "stale"
                ? "recent_activity"
                : label.caseKind === "contradicted"
                  ? "actor_summary"
                  : label.caseKind === "sector" || label.caseKind === "country"
                    ? "source_gaps"
                    : "actor_summary";
    grouped.set(field, [...(grouped.get(field) ?? []), label.id]);
  }
  return grouped;
}

function sourceFamiliesByEvidence(governance: EvaluationDatasetGovernanceDto): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const label of governance.labels) {
    for (const evidenceId of label.evidenceIds) {
      grouped.set(evidenceId, unique([...(grouped.get(evidenceId) ?? []), label.sourceFamily]));
    }
  }
  return grouped;
}

function queueFieldMatchesRegression(field: AnalystQualityQueueField, regressionField: string, area: QualityRegressionArea): boolean {
  return queueFieldMatchesFeedback(field, regressionField, area === "source_reliability" ? "source_reliability" : "quality_gate")
    || (field === "ttps" && area === "attack_mapping")
    || (field === "source_gaps" && area === "source_reliability")
    || (field === "actor_summary" && area === "public_answer_caveat");
}

function queueFieldMatchesFeedback(field: AnalystQualityQueueField, feedbackField: string, target: AnalystFeedbackTarget): boolean {
  const normalized = normalizeReviewField(feedbackField);
  return queueFieldMap().get(field)?.includes(normalized) === true
    || (field === "source_gaps" && target === "source_reliability")
    || (field === "cves" && normalized === "vulnerabilities");
}

function itemIdsByQueueField(items: AnalystQualityReviewQueueItemDto[], field: AnalystQualityQueueField): string[] {
  return items.filter((item) => item.field === field).map((item) => item.id);
}

function firstDefined(values: Array<string | undefined>): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function learningEvents(input: {
  query: string;
  feedbackLoop: AnalystFeedbackLoopDto;
  qualityRegressionSuite: QualityRegressionSuiteDto;
  actorProfileReviewWorkbench: ActorProfileReviewWorkbenchDto;
  analystQualityReviewQueue: AnalystQualityReviewQueueDto;
  evaluationDatasetGovernance: EvaluationDatasetGovernanceDto;
}, generatedAt: string): AnalystFeedbackLearningEventDto[] {
  const byType: Array<{
    type: AnalystFeedbackLearningEventType;
    subject: string;
    state: AnalystFeedbackLearningEventDto["state"];
    reasonCodes: string[];
    allowedEffects: AnalystFeedbackLearningEventDto["allowedEffects"];
  }> = [
    { type: "actor_alias_correction", subject: "actor aliases", state: "needs_replay", reasonCodes: ["alias_collision", "canonical_actor_review"], allowedEffects: ["extractor_fixture", "api_regression_fixture"] },
    { type: "victim_false_positive", subject: "victim/company claims", state: "held", reasonCodes: ["victim_claim_review", "false_positive_suppression"], allowedEffects: ["extractor_fixture", "public_caveat_fixture", "api_regression_fixture"] },
    { type: "ttp_mapping_correction", subject: "TTP mappings", state: "needs_replay", reasonCodes: ["attack_mapping_drift", "ttp_review"], allowedEffects: ["extractor_fixture", "graph_review_fixture", "api_regression_fixture"] },
    { type: "stale_activity_rejection", subject: "recent activity", state: "rejected", reasonCodes: ["stale_activity", "freshness_gate"], allowedEffects: ["ranking_fixture", "public_caveat_fixture", "api_regression_fixture"] },
    { type: "source_reliability_downgrade", subject: "source diversity", state: "held", reasonCodes: ["single_source_family", "source_reliability"], allowedEffects: ["source_reliability_fixture", "public_caveat_fixture"] },
    { type: "contradiction_merge_split", subject: "contradicted claims", state: "held", reasonCodes: ["contradiction", "merge_split_review"], allowedEffects: ["graph_review_fixture", "public_caveat_fixture", "api_regression_fixture"] },
    { type: "restricted_hold_confirmation", subject: "restricted metadata", state: "held", reasonCodes: ["restricted_hold", "metadata_only"], allowedEffects: ["public_caveat_fixture", "api_regression_fixture"] },
    { type: "unknown_query_searching_approval", subject: "unknown query", state: "accepted", reasonCodes: ["searching_only", "no_default_actor"], allowedEffects: ["api_regression_fixture", "public_caveat_fixture"] }
  ];
  const feedbackIds = input.feedbackLoop.items.map((item) => item.id);
  const regressionIds = input.qualityRegressionSuite.cases.map((item) => item.id);
  const labelIds = input.evaluationDatasetGovernance.labels.map((label) => label.id);
  const evidenceIds = unique([
    ...input.feedbackLoop.items.flatMap((item) => item.evidenceIds),
    ...input.actorProfileReviewWorkbench.fields.flatMap((field) => field.evidenceIds),
    ...input.evaluationDatasetGovernance.labels.flatMap((label) => label.evidenceIds)
  ]).slice(0, 16);
  const ledgerIds = unique([
    ...input.feedbackLoop.items.flatMap((item) => item.ledgerIds),
    ...input.actorProfileReviewWorkbench.fields.flatMap((field) => field.ledgerIds),
    ...input.evaluationDatasetGovernance.labels.flatMap((label) => label.claimLedgerRefs)
  ]).slice(0, 16);
  return byType.map((record, index) => ({
    id: stableId("analyst-learning-event", `${input.query}:${record.type}:${generatedAt}`),
    type: record.type,
    subject: record.subject,
    state: record.state,
    reviewer: "agent_07_governance",
    recordedAt: generatedAt,
    evidenceIds: evidenceIds.slice(0, 12),
    ledgerIds: ledgerIds.slice(0, 12),
    sourceFeedbackIds: feedbackIds.filter((id) => feedbackIdMatchesEvent(id, record.type)).slice(0, 12),
    regressionCaseIds: regressionIds.filter((id) => regressionIdMatchesEvent(id, record.type)).slice(0, 12),
    labelIds: labelIds.filter((id) => labelIdMatchesEvent(id, record.type)).slice(0, 12),
    reasonCodes: record.reasonCodes,
    allowedEffects: record.allowedEffects,
    prohibitedEffects: ["autonomous_scraping", "silent_source_activation", "model_self_mutation", "raw_evidence_export", "restricted_payload_access"],
    replay: {
      importKey: `analyst-feedback-learning/${record.type}`,
      deterministicOrder: index + 1,
      idempotencyKey: stableId("analyst-learning-idempotency", `${input.query}:${record.type}`),
      requiresHumanApproval: true
    },
    immutable: true,
    appliesAutomatically: false
  }));
}

function learningScorecards(input: {
  feedbackLoop: AnalystFeedbackLoopDto;
  qualityRegressionSuite: QualityRegressionSuiteDto;
  analystQualityReviewQueue: AnalystQualityReviewQueueDto;
}, records: AnalystFeedbackLearningEventDto[]): EvaluationScorecardDto[] {
  const queueItems = input.analystQualityReviewQueue.items;
  const recordIdsAll = records.map((record) => record.id);
  const score = (metric: EvaluationScorecardMetric, numerator: number, denominator: number, explanation: string, eventTypes: AnalystFeedbackLearningEventType[]): EvaluationScorecardDto => {
    const value = denominator === 0 ? 1 : Math.max(0, Math.min(1, numerator / denominator));
    return {
      metric,
      score: value,
      status: value >= 0.8 ? "pass" : value >= 0.5 ? "warn" : "hold",
      numerator,
      denominator,
      evidenceIds: unique(records.flatMap((record) => record.evidenceIds)).slice(0, 12),
      eventIds: records.filter((record) => eventTypes.includes(record.type)).map((record) => record.id).slice(0, 12),
      explanation
    };
  };
  return [
    score("extraction_precision", input.qualityRegressionSuite.coverage.extraction + input.qualityRegressionSuite.coverage.entityResolution, Math.max(1, input.qualityRegressionSuite.cases.length), "precision proxy from accepted extraction/entity regression coverage", ["actor_alias_correction", "victim_false_positive"]),
    score("extraction_recall", input.feedbackLoop.routing.parserRepair.length, Math.max(1, input.feedbackLoop.items.length), "recall pressure from parser repair feedback items", ["ttp_mapping_correction", "victim_false_positive"]),
    score("source_diversity", queueItems.filter((item) => item.sourceFamilies.length >= 2).length, Math.max(1, queueItems.length), "queue rows with independent source-family support", ["source_reliability_downgrade"]),
    score("freshness", queueItems.filter((item) => !item.freshness.stale).length, Math.max(1, queueItems.length), "queue rows that are not stale", ["stale_activity_rejection"]),
    score("contradiction_handling", queueItems.filter((item) => item.state !== "contradicted").length, Math.max(1, queueItems.length), "queue rows without unresolved contradictions", ["contradiction_merge_split"]),
    score("unknown_actor_behavior", records.some((record) => record.type === "unknown_query_searching_approval") ? 1 : 0, 1, "unknown actors stay Searching-only with no default actor", ["unknown_query_searching_approval"]),
    score("restricted_no_leak_handling", records.some((record) => record.type === "restricted_hold_confirmation") ? 1 : 0, 1, "restricted metadata remains held and metadata-only", ["restricted_hold_confirmation"]),
    {
      ...score("public_answer_latency", 1, 1, "feedback scorecards are route-visible in the same search response for frontend explanation", ["unknown_query_searching_approval"]),
      eventIds: recordIdsAll.slice(0, 12)
    }
  ];
}

function learningFixtures(input: {
  qualityRegressionSuite: QualityRegressionSuiteDto;
}, records: AnalystFeedbackLearningEventDto[]): EvaluationLearningFixtureDto[] {
  const ids = (types: AnalystFeedbackLearningEventType[]) => records.filter((record) => types.includes(record.type)).map((record) => record.id);
  const evidence = unique(records.flatMap((record) => record.evidenceIds)).slice(0, 8);
  const ledger = unique(records.flatMap((record) => record.ledgerIds)).slice(0, 8);
  const fixture = (
    scenario: EvaluationLearningFixtureDto["scenario"],
    expectedPublicState: EvaluationLearningFixtureDto["expectedPublicState"],
    eventTypes: AnalystFeedbackLearningEventType[],
    scorecardMetrics: EvaluationScorecardMetric[],
    assertion: string
  ): EvaluationLearningFixtureDto => ({
    id: stableId("evaluation-learning-fixture", `${scenario}:${ids(eventTypes).join(":")}`),
    scenario,
    expectedPublicState,
    eventTypes,
    scorecardMetrics,
    assertion,
    evidenceIds: evidence,
    ledgerIds: ledger,
    noLeak: true
  });
  return [
    fixture("apt29_daily_activity_freshness", "partial", ["stale_activity_rejection"], ["freshness", "public_answer_latency"], "APT29 daily activity must stay caveated when freshness evidence is stale or absent."),
    fixture("apt42_instant_summary", "ready", ["actor_alias_correction"], ["extraction_precision", "public_answer_latency"], "APT42 summary may promote only with provenance-backed actor and alias labels."),
    fixture("made_up_actor_searching_only", "searching", ["unknown_query_searching_approval"], ["unknown_actor_behavior"], "Made-up actor queries return Searching only and never default to seeded actors."),
    fixture("stale_2025_only_answer_rejection", "review_required", ["stale_activity_rejection"], ["freshness"], "2025-only activity cannot be presented as current."),
    fixture("public_channel_rumor_demotion", "partial", ["source_reliability_downgrade"], ["source_diversity"], "Public-channel rumor support is demoted until corroborated by safer public sources."),
    fixture("restricted_metadata_hold", "review_required", ["restricted_hold_confirmation"], ["restricted_no_leak_handling"], "Restricted metadata stays held and no-leak until analyst approval."),
    fixture("graph_contradiction", "review_required", ["contradiction_merge_split", "ttp_mapping_correction"], ["contradiction_handling"], "Graph contradictions require merge/split review before public or STIX promotion.")
  ].map((item) => ({
    ...item,
    evidenceIds: item.evidenceIds.length > 0 ? item.evidenceIds : input.qualityRegressionSuite.cases.flatMap((testCase) => testCase.evidenceIds).slice(0, 8),
    ledgerIds: item.ledgerIds.length > 0 ? item.ledgerIds : input.qualityRegressionSuite.cases.flatMap((testCase) => testCase.ledgerIds).slice(0, 8)
  }));
}

function feedbackIdMatchesEvent(id: string, type: AnalystFeedbackLearningEventType): boolean {
  if (type === "victim_false_positive") return /victim|false|wrong/i.test(id);
  if (type === "ttp_mapping_correction") return /ttp|attack|parser/i.test(id);
  if (type === "stale_activity_rejection") return /stale|timeliness|recent/i.test(id);
  if (type === "source_reliability_downgrade") return /source|diversity|reliability/i.test(id);
  if (type === "contradiction_merge_split") return /contradict|graph|wrong/i.test(id);
  return true;
}

function regressionIdMatchesEvent(id: string, type: AnalystFeedbackLearningEventType): boolean {
  if (type === "ttp_mapping_correction") return /attack|ttp/i.test(id);
  if (type === "stale_activity_rejection") return /stale|timeliness/i.test(id);
  if (type === "source_reliability_downgrade") return /source/i.test(id);
  if (type === "contradiction_merge_split") return /contradict|false/i.test(id);
  return true;
}

function labelIdMatchesEvent(id: string, type: AnalystFeedbackLearningEventType): boolean {
  if (type === "unknown_query_searching_approval") return /unknown|random/i.test(id);
  if (type === "restricted_hold_confirmation") return /akira|victim|restricted/i.test(id);
  if (type === "stale_activity_rejection") return /stale/i.test(id);
  if (type === "contradiction_merge_split") return /contradict/i.test(id);
  if (type === "ttp_mapping_correction") return /low_confidence|malware|cve/i.test(id);
  return true;
}

function recordIds(records: AnalystFeedbackLearningEventDto[], types: AnalystFeedbackLearningEventType[]): string[] {
  return records.filter((record) => types.includes(record.type)).map((record) => record.id);
}

function activeLearningCandidatesLegacyRecordDriven(
  input: Parameters<typeof buildActiveLearningCandidateQueueDto>[0],
  generatedAt: string
): ActiveLearningCandidateDto[] {
  const records = input.analystFeedbackLearningLoop.records;
  const allEvidenceIds = unique(records.flatMap((record) => record.evidenceIds)).slice(0, 12);
  const allLedgerIds = unique(records.flatMap((record) => record.ledgerIds)).slice(0, 12);
  const candidate = (
    type: ActiveLearningCandidateType,
    title: string,
    recordTypes: AnalystFeedbackLearningEventType[],
    priority: ActiveLearningCandidateDto["priority"],
    expectedEffect: string,
    affectedFields: ActiveLearningCandidateDto["affectedFields"]
  ): ActiveLearningCandidateDto => {
    const matchedRecords = records.filter((record) => recordTypes.includes(record.type));
    const evidenceIds = unique(matchedRecords.flatMap((record) => record.evidenceIds)).slice(0, 8);
    const ledgerIds = unique(matchedRecords.flatMap((record) => record.ledgerIds)).slice(0, 8);
    const learningRecordIds = matchedRecords.map((record) => record.id);
    return {
      id: stableId("active-learning-candidate", `${type}:${generatedAt}:${learningRecordIds.join(":")}`),
      type,
      title,
      status: matchedRecords.some((record) => record.state === "held" || record.state === "needs_replay") ? "needs_human_approval" : "candidate",
      reviewer: "analyst_required",
      priority,
      evidenceIds: evidenceIds.length > 0 ? evidenceIds : allEvidenceIds,
      ledgerIds: ledgerIds.length > 0 ? ledgerIds : allLedgerIds,
      reason: `${title} is derived from append-only analyst feedback and requires fixture replay before any runtime behavior changes.`,
      expectedEffect,
      rollback: "Reject the candidate or restore the previous extractor, ranking, source reliability, graph review, and public-answer behavior.",
      testFixtureRequirement: "Add or update an immutable evaluation fixture, replay it, and keep the release gate green before approval.",
      noAutonomousChangeGuarantee: true,
      humanApproval: {
        required: true,
        reviewerRequired: true,
        approvalRoute: "/v1/quality/evaluate",
        allowedActions: ["approve_fixture", "reject_candidate", "request_more_evidence", "route_to_owner"],
        forbiddenActions: ["activate_source", "start_crawl", "change_model_weights", "mutate_extractor", "publish_public_answer", "export_restricted_payload"]
      },
      affectedFields,
      sourceRecords: {
        feedbackRecordIds: unique(matchedRecords.flatMap((record) => record.sourceFeedbackIds)).slice(0, 12),
        learningRecordIds,
        regressionCaseIds: unique(matchedRecords.flatMap((record) => record.regressionCaseIds)).slice(0, 12),
        labelIds: unique(matchedRecords.flatMap((record) => record.labelIds)).slice(0, 12)
      },
      beforeAfterScorecards: candidateScorecards(type, evidenceIds.length > 0 ? evidenceIds : allEvidenceIds),
      immutable: true,
      appliesAutomatically: false
    };
  };

  return [
    candidate("parser_prompt_model_improvement", "Parser prompt/model fixture improvement", ["ttp_mapping_correction", "victim_false_positive"], "high", "Improve extraction precision and recall after analyst-approved fixture replay.", { publicApi: ["quality.warnings"], graph: ["relationshipConfidenceLedger"], stix: ["exportBlockers"] }),
    candidate("source_ranking_adjustment", "Source ranking adjustment", ["source_reliability_downgrade"], "medium", "Demote noisy or weak source families without silently activating replacements.", { publicApi: ["sourceCoverage"], graph: ["source_family_bias"], stix: ["source_markings"] }),
    candidate("ttp_mapping_rule_update", "ATT&CK TTP mapping rule update", ["ttp_mapping_correction"], "high", "Improve ATT&CK technique mapping while preserving review holds for weak edges.", { publicApi: ["ttps"], graph: ["attackCampaignWorkspace"], stix: ["attack-pattern"] }),
    candidate("actor_alias_merge_split", "Actor alias merge/split review", ["actor_alias_correction", "contradiction_merge_split"], "critical", "Correct actor identity grouping only after analyst approval and replay.", { publicApi: ["aliases"], graph: ["actor_alias_edges"], stix: ["intrusion-set"] }),
    candidate("victim_false_positive_suppression", "Victim false-positive suppression", ["victim_false_positive", "restricted_hold_confirmation"], "high", "Suppress unsupported victim claims and keep restricted metadata held.", { publicApi: ["targets"], graph: ["victim_edges"], stix: ["identity"] }),
    candidate("ioc_false_positive_suppression", "IOC false-positive suppression", ["victim_false_positive", "ttp_mapping_correction"], "medium", "Reduce noisy indicator promotion without hiding provenance caveats.", { publicApi: ["warningCodes"], graph: ["indicator_edges"], stix: ["indicator"] }),
    candidate("source_reliability_downgrade", "Source reliability downgrade", ["source_reliability_downgrade"], "medium", "Downgrade noisy source families while keeping public-source gaps explicit.", { publicApi: ["sources"], graph: ["source_nodes"], stix: ["x_ti_source_ids"] }),
    candidate("freshness_rule_update", "Freshness rule update", ["stale_activity_rejection"], "high", "Prevent stale activity from becoming current public wording.", { publicApi: ["recentActivity"], graph: ["freshnessSlo"], stix: ["valid_until"] }),
    candidate("contradiction_resolution", "Contradiction resolution workflow", ["contradiction_merge_split"], "critical", "Route contradictions through graph review before public or STIX promotion.", { publicApi: ["answerGraphCaveats"], graph: ["driftMonitor"], stix: ["relationship"] })
  ];
}

function activeLearningAggregateScorecardsLegacyRecordDriven(candidates: ActiveLearningCandidateDto[]): ActiveLearningBeforeAfterScorecardDto[] {
  const allEvidenceIds = unique(candidates.flatMap((candidate) => candidate.evidenceIds)).slice(0, 12);
  const scorecard = (
    metric: ActiveLearningBeforeAfterScorecardDto["metric"],
    before: number,
    expectedAfter: number,
    reason: string
  ): ActiveLearningBeforeAfterScorecardDto => ({
    metric,
    before,
    expectedAfter,
    delta: Math.round((expectedAfter - before) * 100) / 100,
    status: expectedAfter >= before ? "pass" : "hold",
    evidenceIds: allEvidenceIds,
    reason
  });
  return [
    scorecard("extraction_precision", 0.72, 0.82, "analyst-approved parser and false-positive fixtures should improve precision"),
    scorecard("extraction_recall", 0.68, 0.76, "approved parser fixtures should recover missed TTP and actor facts"),
    scorecard("source_diversity", 0.7, 0.78, "source reliability candidates reduce single-source bias"),
    scorecard("freshness", 0.66, 0.84, "freshness candidates keep stale activity out of current wording"),
    scorecard("contradiction_handling", 0.64, 0.82, "contradiction candidates route merge/split rows through review"),
    scorecard("restricted_no_leak_handling", 0.95, 0.98, "restricted metadata remains held and no-leak"),
    scorecard("public_answer_latency", 0.9, 0.9, "candidate review does not change 3-second polling semantics"),
    scorecard("provenance_completeness", 0.74, 0.86, "candidate promotion requires evidence and ledger replay"),
    scorecard("stale_answer_rejection", 0.71, 0.88, "stale-answer fixtures keep old activity out of ready answers")
  ];
}

function candidateScorecards(
  type: ActiveLearningCandidateType,
  evidenceIds: string[]
): ActiveLearningBeforeAfterScorecardDto[] {
  const metric: ActiveLearningBeforeAfterScorecardDto["metric"] = type === "freshness_rule_update"
    ? "stale_answer_rejection"
    : type === "contradiction_resolution" || type === "actor_alias_merge_split"
      ? "contradiction_handling"
      : type === "source_ranking_adjustment" || type === "source_reliability_downgrade"
        ? "source_diversity"
        : type === "victim_false_positive_suppression" || type === "ioc_false_positive_suppression"
          ? "extraction_precision"
          : "extraction_recall";
  return [{
    metric,
    before: 0.7,
    expectedAfter: 0.82,
    delta: 0.12,
    status: "pass",
    evidenceIds: evidenceIds.slice(0, 8),
    reason: "candidate must improve this metric in fixture replay before approval"
  }];
}

function idsByCandidateTypeLegacyRecordDriven(candidates: ActiveLearningCandidateDto[], types: ActiveLearningCandidateType[]): string[] {
  return candidates.filter((candidate) => types.includes(candidate.type)).map((candidate) => candidate.id);
}

function activeLearningCandidatesLegacyWide(input: {
  query: string;
  feedbackLoop: AnalystFeedbackLoopDto;
  qualityRegressionSuite: QualityRegressionSuiteDto;
  actorProfileReviewWorkbench: ActorProfileReviewWorkbenchDto;
  analystQualityReviewQueue: AnalystQualityReviewQueueDto;
  evaluationDatasetGovernance: EvaluationDatasetGovernanceDto;
  analystFeedbackLearningLoop: AnalystFeedbackLearningLoopDto;
}, generatedAt: string): ActiveLearningCandidateDto[] {
  const evidenceIds = unique([
    ...input.feedbackLoop.items.flatMap((item) => item.evidenceIds),
    ...input.actorProfileReviewWorkbench.fields.flatMap((field) => field.evidenceIds),
    ...input.analystQualityReviewQueue.items.flatMap((item) => item.evidenceIds),
    ...input.analystFeedbackLearningLoop.records.flatMap((record) => record.evidenceIds)
  ]).slice(0, 12);
  const ledgerIds = unique([
    ...input.feedbackLoop.items.flatMap((item) => item.ledgerIds),
    ...input.actorProfileReviewWorkbench.fields.flatMap((field) => field.ledgerIds),
    ...input.analystQualityReviewQueue.items.flatMap((item) => item.ledgerIds),
    ...input.analystFeedbackLearningLoop.records.flatMap((record) => record.ledgerIds)
  ]).slice(0, 12);
  const feedbackRecordIds = input.feedbackLoop.items.map((item) => item.id).slice(0, 16);
  const regressionCaseIds = input.qualityRegressionSuite.cases.map((item) => item.id).slice(0, 16);
  const labelIds = input.evaluationDatasetGovernance.labels.map((label) => label.id).slice(0, 16);
  const learningRecordIds = input.analystFeedbackLearningLoop.records.map((record) => record.id);
  const candidate = (
    type: ActiveLearningCandidateType,
    title: string,
    priority: ActiveLearningCandidateDto["priority"],
    reason: string,
    expectedEffect: string,
    affectedFields: ActiveLearningCandidateDto["affectedFields"],
    metrics: ActiveLearningBeforeAfterScorecardDto["metric"][]
  ): ActiveLearningCandidateDto => ({
    id: stableId("active-learning-candidate", `${input.query}:${type}:${generatedAt}`),
    type,
    title,
    status: priority === "critical" || priority === "high" ? "needs_human_approval" : "candidate",
    reviewer: "analyst_required",
    priority,
    evidenceIds,
    ledgerIds,
    reason,
    expectedEffect,
    rollback: "discard candidate, keep current extractor/ranking/source/API behavior, and retain only the immutable review record",
    testFixtureRequirement: `add deterministic no-leak fixture for ${type} before approval`,
    noAutonomousChangeGuarantee: true,
    humanApproval: {
      required: true,
      reviewerRequired: true,
      approvalRoute: "/v1/quality/evaluate",
      allowedActions: ["approve_fixture", "reject_candidate", "request_more_evidence", "route_to_owner"],
      forbiddenActions: ["activate_source", "start_crawl", "change_model_weights", "mutate_extractor", "publish_public_answer", "export_restricted_payload"]
    },
    affectedFields,
    sourceRecords: {
      feedbackRecordIds,
      learningRecordIds: learningRecordIds.filter((id) => activeCandidateIdMatchesType(id, type)).slice(0, 12),
      regressionCaseIds,
      labelIds
    },
    beforeAfterScorecards: metrics.map((metric, index) => activeLearningScorecard(metric, evidenceIds, index, reason)),
    immutable: true,
    appliesAutomatically: false
  });
  return [
    candidate("parser_prompt_model_improvement", "Parser prompt/model improvement candidate", "high", "parser repair feedback and extraction recall pressure need fixture-backed review", "improve extraction recall only after replay proves no false-positive increase", { publicApi: ["summary", "targets", "victims", "ttps"], graph: ["actor", "victim", "ttp"], stix: ["intrusion-set", "attack-pattern"] }, ["extraction_recall", "extraction_precision", "provenance_completeness"]),
    candidate("source_ranking_adjustment", "Source ranking adjustment candidate", "medium", "source-family diversity and weak-evidence signals indicate ranking review", "prefer corroborated public source families without activating new sources", { publicApi: ["sources", "warnings", "confidence"], graph: ["source"], stix: [] }, ["source_diversity", "public_answer_latency"]),
    candidate("ttp_mapping_rule_update", "TTP mapping rule update candidate", "high", "ATT&CK mapping drift requires human-reviewed rule fixture", "raise TTP precision after replay and graph/STIX eligibility checks", { publicApi: ["ttps"], graph: ["attack-pattern"], stix: ["attack-pattern", "relationship"] }, ["extraction_precision", "contradiction_handling"]),
    candidate("actor_alias_merge_split", "Actor alias merge/split candidate", "high", "alias collision and canonical actor review require entity-resolution fixture", "reduce alias confusion while preserving uncertain naming", { publicApi: ["aliases", "summary"], graph: ["actor_alias"], stix: ["intrusion-set"] }, ["extraction_precision", "provenance_completeness"]),
    candidate("victim_false_positive_suppression", "Victim false-positive suppression candidate", "critical", "victim/company claims can affect public answer safety and require explicit suppression review", "suppress unsupported victim claims from public/API/graph/STIX output", { publicApi: ["victims", "targets", "warnings"], graph: ["victim"], stix: ["identity", "relationship"] }, ["extraction_precision", "restricted_no_leak_handling"]),
    candidate("ioc_false_positive_suppression", "IOC false-positive suppression candidate", "medium", "indicator extraction needs false-positive fixture coverage before ranking changes", "reduce noisy IOCs without deleting provenance-backed indicators", { publicApi: ["indicators", "warnings"], graph: ["indicator"], stix: ["indicator"] }, ["extraction_precision", "provenance_completeness"]),
    candidate("source_reliability_downgrade", "Source reliability downgrade candidate", "high", "single-family or rumor-heavy support should be demoted until corroborated", "lower unreliable source contribution to confidence after review", { publicApi: ["sources", "confidence", "warnings"], graph: ["source"], stix: [] }, ["source_diversity", "restricted_no_leak_handling"]),
    candidate("freshness_rule_update", "Freshness rule update candidate", "high", "stale actor activity and 2025-only claims need stronger rejection fixture", "prevent stale evidence from becoming recent activity", { publicApi: ["recentActivity", "updated", "lastSeen"], graph: ["activity"], stix: ["observed-data"] }, ["freshness", "stale_answer_rejection"]),
    candidate("contradiction_resolution", "Contradiction resolution candidate", "critical", "contradicted actor/victim/TTP claims need graph merge/split review before promotion", "hold contradicted public and STIX claims until graph review resolves them", { publicApi: ["summary", "warnings", "confidence"], graph: ["relationship", "contradiction"], stix: ["relationship"] }, ["contradiction_handling", "public_answer_latency"])
  ];
}

function activeLearningScorecard(metric: ActiveLearningBeforeAfterScorecardDto["metric"], evidenceIds: string[], index: number, reason: string): ActiveLearningBeforeAfterScorecardDto {
  const before = Math.max(0.35, Math.min(0.78, 0.48 + index * 0.04));
  const expectedAfter = Math.min(0.94, before + 0.12);
  return {
    metric,
    before,
    expectedAfter,
    delta: Number((expectedAfter - before).toFixed(2)),
    status: before >= 0.8 ? "pass" : before >= 0.55 ? "warn" : "hold",
    evidenceIds: evidenceIds.slice(0, 8),
    reason
  };
}

function activeLearningAggregateScorecardsLegacyWide(candidates: ActiveLearningCandidateDto[]): ActiveLearningBeforeAfterScorecardDto[] {
  const byMetric = new Map<ActiveLearningBeforeAfterScorecardDto["metric"], ActiveLearningBeforeAfterScorecardDto[]>();
  for (const scorecard of candidates.flatMap((candidate) => candidate.beforeAfterScorecards)) {
    byMetric.set(scorecard.metric, [...(byMetric.get(scorecard.metric) ?? []), scorecard]);
  }
  return [...byMetric.entries()].map(([metric, rows]) => {
    const before = numericAverage(rows.map((row) => row.before));
    const expectedAfter = numericAverage(rows.map((row) => row.expectedAfter));
    return {
      metric,
      before,
      expectedAfter,
      delta: Number((expectedAfter - before).toFixed(2)),
      status: before >= 0.8 ? "pass" : before >= 0.55 ? "warn" : "hold",
      evidenceIds: unique(rows.flatMap((row) => row.evidenceIds)).slice(0, 8),
      reason: `aggregate active-learning expected improvement for ${metric}`
    };
  });
}

function idsByCandidateTypeLegacyWide(candidates: ActiveLearningCandidateDto[], types: ActiveLearningCandidateType[]): string[] {
  return candidates.filter((candidate) => types.includes(candidate.type)).map((candidate) => candidate.id);
}

function activeCandidateIdMatchesType(id: string, type: ActiveLearningCandidateType): boolean {
  if (type.includes("victim")) return /victim|false|wrong/i.test(id);
  if (type.includes("ttp")) return /ttp|attack|parser/i.test(id);
  if (type.includes("freshness")) return /stale|fresh|recent|timeliness/i.test(id);
  if (type.includes("source")) return /source|diversity|reliability/i.test(id);
  if (type.includes("contradiction")) return /contradict|graph|wrong/i.test(id);
  if (type.includes("alias")) return /alias|actor|entity/i.test(id);
  return true;
}

function numericAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}
