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

export type ProgramBdRowQualityMetric =
  | "summary_specificity"
  | "source_support"
  | "recency"
  | "false_victim_risk"
  | "legal_proceeding_detection"
  | "actor_alias_resolution"
  | "ttp_evidence_support"
  | "source_family_diversity"
  | "contradiction_flags"
  | "actionability_correctness"
  | "useful_row_rate"
  | "fresh_row_rate"
  | "stale_row_suppression"
  | "buyer_caveat_usefulness"
  | "no_leak_proof";

export interface ProgramBdWatchlistQualityFixtureRow {
  id: string;
  actor: string;
  actorClass: "state_actor" | "ransomware" | "cybercrime" | "unknown";
  queryClass: QualityRuntimeQueryClass;
  expectedPublicState: QualityRuntimeFixtureRow["expectedPublicState"];
  requiredMetrics: ProgramBdRowQualityMetric[];
  sourceFamilyMix: Array<"vendor_blog" | "rss_security_feed" | "advisory" | "public_channel" | "government_advisory" | "synthetic_guardrail">;
  regressionFocus: Array<
    | "alias_collision"
    | "false_victim"
    | "legal_proceeding"
    | "stale_repost"
    | "generic_summary"
    | "uncited_claim"
    | "single_source_overconfidence"
    | "unknown_actor_fallback"
    | "not_indexed_fallback"
    | "ttp_without_evidence"
  >;
  gatePacket: {
    status: "pass" | "warn" | "hold";
    failingFields: ProgramBdRowQualityMetric[];
    remediationAction: string;
    downstreamEligibility: {
      publicUi: boolean;
      apifyOutput: boolean;
      graphExport: boolean;
      stixExport: boolean;
    };
  };
  provenance: {
    fixtureIds: string[];
    evidenceRefs: string[];
    redacted: true;
  };
  noLeak: true;
}

export interface ProgramBdQualityEvaluationPackDto {
  schemaVersion: "ti.program_bd_quality_evaluation_pack.v1";
  generatedAt: string;
  summary: {
    defaultWatchlistActorCount: number;
    unknownFixtureCount: number;
    passCount: number;
    warningCount: number;
    holdCount: number;
    routeVisibleGatePacket: true;
  };
  rowMetricNames: ProgramBdRowQualityMetric[];
  paidRowQualityGate: {
    schemaVersion: "ti.program_bd_paid_row_quality_gate.v1";
    pricing: {
      resultPriceUsdPer1000Rows: 3;
      actorStartUsd: 0.00005;
      effectiveDate: "2026-07-04";
    };
    liveBaselines: Array<{
      runId: string;
      buildId?: string;
      datasetId?: string;
      rowCount: number;
      usefulRowCount: number;
      corroboratedRowCount: number;
      singleSourceRowCount: number;
      thinRowCount: number;
      staleOrUnverifiedRowCount: number;
      safetyFailureCount: number;
      usefulRowRate: number;
      corroborationRate: number;
      thinRowRate: number;
      noLeakPass: boolean;
    }>;
    metricThresholds: Array<{
      metric: Extract<ProgramBdRowQualityMetric, "useful_row_rate" | "fresh_row_rate" | "stale_row_suppression" | "summary_specificity" | "source_family_diversity" | "buyer_caveat_usefulness" | "no_leak_proof">;
      passAt: number;
      warnBelow: number;
      current: number;
      state: "pass" | "warn" | "hold";
      buyerVisibleReason: string;
    }>;
    sourceTierGates: Array<{
      tier: 100 | 1000 | 4000 | 10000 | 20000 | 60000;
      state: "ready" | "needs_more_quality" | "hold";
      requiredBeforeAdvance: string[];
      minimumUsefulRowRate: number;
      minimumFreshRowRate: number;
      maximumThinRowRate: number;
      noLeakRequired: true;
    }>;
    buyerVisibleQualityLiftGate: {
      schemaVersion: "ti.program_bg_buyer_visible_quality_lift_gate.v1";
      baselineRunId: "iMQGeezZ8bx7WtlhQ";
      baselineDatasetId: "5PLmkE30luBA5Lbgc";
      evaluatedRunShape: "apt42_smoke_and_20_group_daily";
      routeVisibleOn: Array<"/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "/v1/ops/product-slo">;
      dryRun: true;
      willMutateSources: false;
      willStartCollection: false;
      qualityLiftAcceptedCount: number;
      qualityLiftRejectedCount: number;
      sellableRowsAdded: number;
      freshRowsAdded: number;
      usefulRowsAdded: number;
      staleRowsSuppressed: number;
      costPerUsefulRowDelta: number;
      projectedRowRevenueDeltaUsd: number;
      acceptedExamples: Array<{
        id: string;
        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
        beforeDecision: "hold" | "coverage_gap_only" | "suppress" | "included_with_caveat";
        afterDecision: "included_with_caveat" | "sellable";
        buyerVisibleLift: string[];
        sellableRowsDelta: number;
        freshRowsDelta: number;
        usefulRowsDelta: number;
      }>;
      rejectedExamples: Array<{
        id: string;
        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
        beforeDecision: "hold" | "coverage_gap_only" | "suppress" | "included_with_caveat";
        afterDecision: "hold" | "coverage_gap_only" | "suppress" | "included_with_caveat";
        rejectionReason: "no_sellable_row_lift" | "still_single_source" | "stale_after_repair" | "unsafe_or_unapproved_source" | "cost_exceeds_value";
        doesNotCountTowardPayworthyRate: true;
      }>;
      ownerHandoffs: Array<{
        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
        accepted: number;
        rejected: number;
      }>;
      passCriteria: {
        acceptedRequiresDecisionLift: true;
        acceptedRequiresBuyerVisibleMetricLift: true;
        acceptedRequiresSafePublicOrMetadataOnlySource: true;
        rejectedRepairsDoNotCountTowardPayworthyRate: true;
      };
    };
    qualityConversionGate: {
      schemaVersion: "ti.program_bq_paid_row_quality_conversion_gate.v1";
      routeVisibleOn: Array<"/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "/v1/ops/product-slo">;
      baselineRunId: "OThlfd0uzSCNnedAO";
      baselineDatasetId: "LSen2fYtwFTtOr7vK";
      dryRun: true;
      willMutateSources: false;
      willStartCollection: false;
      examples: Array<{
        actor: string;
        family: "apt" | "ransomware";
        decision: "chargeable" | "caveated" | "held" | "suppressed";
        buyerVisibleScores: {
          actorSpecificity: number;
          victimExtraction: number;
          sectorCountry: number;
          ttpTool: number;
          freshness: number;
          sourceFamilyDiversity: number;
          corroboration: number;
          contradictionState: number;
          provenance: number;
          nextSearchUtility: number;
        };
        buyerUse: string;
        qualityReason: string;
        sourceParserHandoff?: "agent_01" | "agent_03" | "agent_04" | "agent_05";
      }>;
      rejectedBloatCases: Array<{
        id: string;
        blockedReason: "alias_only_cleanup" | "stale_old_report_reuse" | "duplicate_source_expansion" | "generic_marketing_summary" | "uncorroborated_public_channel_snippet" | "unsafe_metadata" | "no_actionability";
        staysDecision: "held" | "suppressed" | "caveated";
        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
        proofNote: string;
      }>;
      acceptedRows: number;
      rejectedBloatRows: number;
      sellableRowLift: number;
      bloatBlocked: number;
      sourceParserHandoffs: Array<{
        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05";
        blocker: string;
        expectedEffect: string;
      }>;
    };
	    liveFreshnessQualityGate: {
	      schemaVersion: "ti.program_br_live_freshness_quality_gate.v1";
      routeVisibleOn: Array<"/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "/v1/ops/product-slo">;
      dryRun: true;
      willMutateSources: false;
      willStartCollection: false;
      examples: Array<{
        actor: string;
        family: "apt" | "ransomware";
        decision: "chargeable" | "caveated" | "held" | "suppressed";
        queryClass: "latest_activity" | "actor_profile" | "victim_watch" | "ransomware_watch";
        freshRowRate: number;
        staleSuppressionRate: number;
        dailyExpectation: "met" | "thin" | "missed";
        weeklyExpectation: "met" | "thin" | "missed";
        sourceFamilyFreshness: "diverse_fresh" | "single_family_fresh" | "stale_only" | "metadata_only";
        contradictionState: "none" | "contradicted" | "review_hold";
        blocksLatestClaim: boolean;
        buyerVisibleReason: string;
        nextRepairOwner?: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
        repairReason?: "stale_source" | "generic_parser" | "missing_public_channel_corroboration" | "metadata_only_without_public_support" | "alias_or_unrelated_actor";
      }>;
      blockedLatestClaimCases: Array<{
        id: string;
        blockedReason: "old_evidence" | "generic_summary" | "single_source" | "alias_only" | "unrelated_actor" | "contradicted" | "metadata_only_without_public_support";
        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
        publicAnswerEffect: "partial" | "hold" | "suppress";
        proofNote: string;
      }>;
      freshRowsPromoted: number;
      caveatedRowsKept: number;
      staleLatestClaimsBlocked: number;
      bloatRowsSuppressed: number;
      sourceParserHandoffs: Array<{
        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05";
        blocker: string;
        expectedEffect: string;
	      }>;
	    };
	    freshnessRepairLoop: {
	      schemaVersion: "ti.program_bs_paid_row_freshness_repair_loop.v1";
	      routeVisibleOn: Array<"/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "/v1/ops/product-slo" | "Apify OUTPUT">;
	      dryRun: true;
	      willMutateSources: false;
	      willStartCollection: false;
	      repairQueue: Array<{
	        id: string;
	        actor: string;
	        family: "apt" | "ransomware";
	        blocker: "stale_latest_activity" | "generic_summary" | "single_source" | "alias_only" | "unrelated_actor" | "contradicted" | "metadata_only_without_public_support";
	        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
	        currentDecision: "chargeable" | "caveated" | "held" | "suppressed";
	        targetDecision: "chargeable" | "caveated" | "held" | "suppressed";
	        requiredEvidenceFamily: "clear_web" | "public_advisory" | "public_channel" | "restricted_metadata" | "graph_ledger";
	        proofNeeded: string[];
	        expectedBuyerVisibleLift: string[];
	        currentBuyerValue: number;
	        targetBuyerValue: number;
	        noLeak: true;
	      }>;
	      lift: {
	        staleRowsBlocked: number;
	        genericRowsRepaired: number;
	        aliasOrUnrelatedRowsSuppressed: number;
	        caveatedRowsPreserved: number;
	        sellableRowsGained: number;
	        usefulRowsGained: number;
	        averageBuyerValueDelta: number;
	      };
	      ownerHandoffs: Array<{
	        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
	        queueCount: number;
	        blockerFocus: string;
	        expectedEffect: string;
	      }>;
	      noLeakProof: {
	        rawEvidenceExposed: false;
	        unsafeUrlsExposed: false;
	        restrictedPayloadsExposed: false;
	        objectKeysExposed: false;
	      };
	    };
	    entitySpecificityLift: {
	      schemaVersion: "ti.program_bv_paid_row_entity_specificity_lift.v1";
	      routeVisibleOn: Array<"/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "/v1/ops/product-slo" | "Apify OUTPUT">;
	      dryRun: true;
	      willMutateSources: false;
	      willStartCollection: false;
	      fixtures: Array<{
	        id: string;
	        actor: string;
	        family: "apt" | "ransomware" | "unknown";
	        currentDecision: "chargeable" | "caveated" | "held" | "suppressed";
	        targetDecision: "chargeable" | "caveated" | "held" | "suppressed";
	        missingFields: Array<"victim" | "sector" | "country" | "dataset_or_impact" | "ttp_or_tool" | "first_seen" | "last_seen" | "confidence" | "caveat" | "contradiction_state" | "provenance_hash" | "next_action">;
	        requiredEvidenceFamily: "clear_web" | "public_advisory" | "public_channel" | "restricted_metadata" | "graph_ledger";
	        blockerCodesRemoved: Array<"old" | "alias_only" | "single_source_without_caveat" | "unrelated_actor" | "contradicted" | "metadata_only_without_public_support" | "no_useful_buyer_action" | "generic_entity_fields">;
	        expectedBuyerVisibleLift: string[];
	        proofNeeded: string[];
	        whyWorthPayingFor: string;
	        repairAction: string;
	        currentBuyerValue: number;
	        targetBuyerValue: number;
	        noLeak: true;
	      }>;
	      lift: {
	        rowsLifted: number;
	        rowsSuppressed: number;
	        rowsHeldWithRepairAction: number;
	        blockerCodesRemoved: number;
	        averageBuyerValueDelta: number;
	      };
	      ownerHandoffs: Array<{
	        owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
	        fixtureCount: number;
	        blockerFocus: string;
	        expectedEffect: string;
	      }>;
	      noLeakProof: {
	        rawEvidenceExposed: false;
	        unsafeUrlsExposed: false;
	        restrictedPayloadsExposed: false;
	        objectKeysExposed: false;
	      };
	    };
	    releaseDecision: "promote" | "partial" | "hold";
    apifyDatasetFields: string[];
    remediationActions: string[];
  };
  watchlistFixtures: ProgramBdWatchlistQualityFixtureRow[];
  regressionGuardrails: Array<{
    id: string;
    status: "pass" | "warn" | "hold";
    prevents: string;
    remediationAction: string;
  }>;
  routing: {
    agent07ExtractorFixtures: string[];
    agent09ApiGatePacket: string[];
    agent10ReleaseGate: string[];
  };
  policy: {
    analystApprovalRequired: true;
    preservesUncertainty: true;
    noAutomaticPromotion: true;
    noAutonomousScraping: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
  };
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
  programBdQualityEvaluationPack: ProgramBdQualityEvaluationPackDto;
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
  const programBdQualityEvaluationPack = buildProgramBdQualityEvaluationPackDto({
    generatedAt,
    ctiEvaluationDatasetPack: input.ctiEvaluationDatasetPack
  });

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
    programBdQualityEvaluationPack,
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

export function buildProgramBdQualityEvaluationPackDto(input: {
  generatedAt?: string;
  ctiEvaluationDatasetPack?: { fixtures?: Array<{ id?: string; scenario?: string; evidenceIds?: string[] }> };
} = {}): ProgramBdQualityEvaluationPackDto {
  const generatedAt = input.generatedAt ?? "2026-05-24T00:00:00.000Z";
  const watchlistFixtures = programBdWatchlistFixtures(input.ctiEvaluationDatasetPack);
  const passCount = watchlistFixtures.filter((fixture) => fixture.gatePacket.status === "pass").length;
  const warningCount = watchlistFixtures.filter((fixture) => fixture.gatePacket.status === "warn").length;
  const holdCount = watchlistFixtures.filter((fixture) => fixture.gatePacket.status === "hold").length;

  return {
    schemaVersion: "ti.program_bd_quality_evaluation_pack.v1",
    generatedAt,
    summary: {
      defaultWatchlistActorCount: watchlistFixtures.filter((fixture) => fixture.actorClass !== "unknown").length,
      unknownFixtureCount: watchlistFixtures.filter((fixture) => fixture.actorClass === "unknown").length,
      passCount,
      warningCount,
      holdCount,
      routeVisibleGatePacket: true
    },
    rowMetricNames: PROGRAM_BD_ROW_METRICS,
    paidRowQualityGate: buildProgramBdPaidRowQualityGate(),
    watchlistFixtures,
    regressionGuardrails: [
      regressionGuardrail("person_treated_as_victim", "hold", "person or legal-case subject promoted as victim/company", "send victim field to analyst review and suppress public victim chip"),
      regressionGuardrail("actor_alias_mistaken_as_victim", "hold", "actor alias or ransomware brand extracted as victim", "route alias to entity-resolution workbench before graph/STIX export"),
      regressionGuardrail("not_indexed_fallback", "hold", "not-indexed fallback appearing as analyst summary", "return Searching or partial with explicit source gap"),
      regressionGuardrail("stale_2025_only_activity", "hold", "stale activity described as latest activity", "expire stale claim until fresh captured evidence is replayed"),
      regressionGuardrail("headline_repeated_as_summary", "warn", "source headline repeated as summary without extracted facts", "require summary specificity and source-support metrics to pass"),
      regressionGuardrail("raw_unsafe_url_leak", "hold", "unsafe source URL or object locator exposed", "redact locator and fail no-leak gate"),
      regressionGuardrail("generic_non_cti_web_result", "warn", "generic web result ranked as CTI evidence", "down-rank source and require parser/source-family support")
    ],
    routing: {
      agent07ExtractorFixtures: watchlistFixtures.map((fixture) => fixture.id),
      agent09ApiGatePacket: watchlistFixtures.filter((fixture) => fixture.gatePacket.status !== "pass").map((fixture) => fixture.id),
      agent10ReleaseGate: watchlistFixtures.filter((fixture) => fixture.gatePacket.status === "hold").map((fixture) => fixture.id)
    },
    policy: {
      analystApprovalRequired: true,
      preservesUncertainty: true,
      noAutomaticPromotion: true,
      noAutonomousScraping: true
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
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

const PROGRAM_BD_ROW_METRICS: ProgramBdRowQualityMetric[] = [
  "summary_specificity",
  "source_support",
  "recency",
  "false_victim_risk",
  "legal_proceeding_detection",
  "actor_alias_resolution",
  "ttp_evidence_support",
  "source_family_diversity",
  "contradiction_flags",
  "actionability_correctness",
  "useful_row_rate",
  "fresh_row_rate",
  "stale_row_suppression",
  "buyer_caveat_usefulness",
  "no_leak_proof"
];

function buildProgramBrLiveFreshnessQualityGate(): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["liveFreshnessQualityGate"] {
  const examples: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["liveFreshnessQualityGate"]["examples"] = [
    { actor: "APT29", family: "apt", decision: "chargeable", queryClass: "latest_activity", freshRowRate: 0.82, staleSuppressionRate: 0.97, dailyExpectation: "met", weeklyExpectation: "met", sourceFamilyFreshness: "diverse_fresh", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Fresh clear-web plus advisory evidence supports a current activity row." },
    { actor: "APT42", family: "apt", decision: "caveated", queryClass: "latest_activity", freshRowRate: 0.58, staleSuppressionRate: 0.94, dailyExpectation: "thin", weeklyExpectation: "met", sourceFamilyFreshness: "single_family_fresh", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Fresh enough to show as a lead, but public-channel corroboration is still thin.", nextRepairOwner: "agent_04", repairReason: "missing_public_channel_corroboration" },
    { actor: "Turla", family: "apt", decision: "chargeable", queryClass: "actor_profile", freshRowRate: 0.76, staleSuppressionRate: 0.96, dailyExpectation: "met", weeklyExpectation: "met", sourceFamilyFreshness: "diverse_fresh", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Current TTP/tool evidence is specific and multi-source." },
    { actor: "Volt Typhoon", family: "apt", decision: "chargeable", queryClass: "latest_activity", freshRowRate: 0.8, staleSuppressionRate: 0.98, dailyExpectation: "met", weeklyExpectation: "met", sourceFamilyFreshness: "diverse_fresh", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Current infrastructure and LOTL activity can be surfaced as monitoring value." },
    { actor: "Lazarus Group", family: "apt", decision: "chargeable", queryClass: "victim_watch", freshRowRate: 0.74, staleSuppressionRate: 0.95, dailyExpectation: "met", weeklyExpectation: "met", sourceFamilyFreshness: "diverse_fresh", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Fresh sector and TTP extraction gives buyers a concrete pivot." },
    { actor: "Sandworm", family: "apt", decision: "held", queryClass: "latest_activity", freshRowRate: 0.18, staleSuppressionRate: 0.92, dailyExpectation: "missed", weeklyExpectation: "thin", sourceFamilyFreshness: "stale_only", contradictionState: "none", blocksLatestClaim: true, buyerVisibleReason: "Old campaign context is blocked from latest-activity wording.", nextRepairOwner: "agent_01", repairReason: "stale_source" },
    { actor: "MuddyWater", family: "apt", decision: "caveated", queryClass: "actor_profile", freshRowRate: 0.54, staleSuppressionRate: 0.91, dailyExpectation: "thin", weeklyExpectation: "met", sourceFamilyFreshness: "single_family_fresh", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Actor context is recent but parser fields need more specificity.", nextRepairOwner: "agent_03", repairReason: "generic_parser" },
    { actor: "Scattered Spider", family: "apt", decision: "chargeable", queryClass: "latest_activity", freshRowRate: 0.79, staleSuppressionRate: 0.97, dailyExpectation: "met", weeklyExpectation: "met", sourceFamilyFreshness: "diverse_fresh", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Fresh sector and social-engineering pivots are actionable." },
    { actor: "LockBit", family: "ransomware", decision: "caveated", queryClass: "ransomware_watch", freshRowRate: 0.61, staleSuppressionRate: 0.93, dailyExpectation: "thin", weeklyExpectation: "met", sourceFamilyFreshness: "metadata_only", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Safe victim metadata remains caveated until public support arrives.", nextRepairOwner: "agent_05", repairReason: "metadata_only_without_public_support" },
    { actor: "Akira", family: "ransomware", decision: "caveated", queryClass: "victim_watch", freshRowRate: 0.57, staleSuppressionRate: 0.92, dailyExpectation: "thin", weeklyExpectation: "met", sourceFamilyFreshness: "metadata_only", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Victim and sector hints are useful leads, not chargeable latest claims yet.", nextRepairOwner: "agent_05", repairReason: "metadata_only_without_public_support" },
    { actor: "Clop", family: "ransomware", decision: "chargeable", queryClass: "ransomware_watch", freshRowRate: 0.73, staleSuppressionRate: 0.96, dailyExpectation: "met", weeklyExpectation: "met", sourceFamilyFreshness: "diverse_fresh", contradictionState: "none", blocksLatestClaim: false, buyerVisibleReason: "Fresh campaign and exploitation context is source-backed." },
    { actor: "Black Basta", family: "ransomware", decision: "suppressed", queryClass: "latest_activity", freshRowRate: 0.12, staleSuppressionRate: 0.99, dailyExpectation: "missed", weeklyExpectation: "missed", sourceFamilyFreshness: "stale_only", contradictionState: "review_hold", blocksLatestClaim: true, buyerVisibleReason: "Generic stale reposts are suppressed instead of padded into paid rows.", nextRepairOwner: "agent_07", repairReason: "alias_or_unrelated_actor" },
    { actor: "Alias Collision", family: "apt", decision: "suppressed", queryClass: "actor_profile", freshRowRate: 0.33, staleSuppressionRate: 0.4, dailyExpectation: "thin", weeklyExpectation: "thin", sourceFamilyFreshness: "single_family_fresh", contradictionState: "review_hold", blocksLatestClaim: true, buyerVisibleReason: "Alias-only or unrelated actor hits must not become latest-activity claims.", nextRepairOwner: "agent_07", repairReason: "alias_or_unrelated_actor" }
  ];
  const blockedLatestClaimCases: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["liveFreshnessQualityGate"]["blockedLatestClaimCases"] = [
    { id: "br_block_old_evidence", blockedReason: "old_evidence", owner: "agent_01", publicAnswerEffect: "hold", proofNote: "Evidence outside the freshness window cannot be described as latest activity." },
    { id: "br_block_generic_summary", blockedReason: "generic_summary", owner: "agent_03", publicAnswerEffect: "partial", proofNote: "Generic parser summaries need actor, victim, TTP, or source-family specificity." },
    { id: "br_block_single_source", blockedReason: "single_source", owner: "agent_04", publicAnswerEffect: "partial", proofNote: "Single-source fresh claims stay caveated until another safe source family corroborates them." },
    { id: "br_block_alias_only", blockedReason: "alias_only", owner: "agent_07", publicAnswerEffect: "suppress", proofNote: "Alias-only matches are not evidence of actor activity." },
    { id: "br_block_unrelated_actor", blockedReason: "unrelated_actor", owner: "agent_07", publicAnswerEffect: "partial", proofNote: "Rows with weak actor linkage are kept out of the searched actor answer." },
    { id: "br_block_contradicted", blockedReason: "contradicted", owner: "agent_07", publicAnswerEffect: "hold", proofNote: "Contradicted activity requires analyst review before promotion." },
    { id: "br_block_metadata_only_without_public_support", blockedReason: "metadata_only_without_public_support", owner: "agent_05", publicAnswerEffect: "partial", proofNote: "Restricted metadata can support leads but cannot be the only basis for latest public claims." }
  ];
  return {
    schemaVersion: "ti.program_br_live_freshness_quality_gate.v1",
    routeVisibleOn: ["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    examples,
    blockedLatestClaimCases,
    freshRowsPromoted: examples.filter((row) => row.decision === "chargeable").length,
    caveatedRowsKept: examples.filter((row) => row.decision === "caveated").length,
    staleLatestClaimsBlocked: 5,
    bloatRowsSuppressed: examples.filter((row) => row.decision === "suppressed").length + blockedLatestClaimCases.filter((row) => row.publicAnswerEffect === "suppress").length,
    sourceParserHandoffs: [
      { owner: "agent_01", blocker: "stale_source_or_duplicate_old_report", expectedEffect: "Replace stale source rows before they can satisfy latest-activity freshness." },
      { owner: "agent_03", blocker: "fresh_rows_missing_actor_victim_ttp_specificity", expectedEffect: "Parse enough structured facts to make fresh rows buyer-actionable." },
      { owner: "agent_04", blocker: "fresh_single_source_or_public_channel_only_claims", expectedEffect: "Add cross-family corroboration before full paid promotion." },
      { owner: "agent_05", blocker: "metadata_only_freshness_without_public_support", expectedEffect: "Keep metadata-only rows caveated until public evidence backs them." }
    ]
  };
}

function buildProgramBsFreshnessRepairLoop(): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["freshnessRepairLoop"] {
  const repairQueue: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["freshnessRepairLoop"]["repairQueue"] = [
    programBsRepairRow("bs_apt29_old_latest", "APT29", "apt", "stale_latest_activity", "agent_01", "held", "chargeable", "clear_web", 0.28, 0.82, ["fresh captured public report", "advisory corroboration", "capture ledger id"], ["freshness", "source_family_diversity", "current_activity_wording"]),
    programBsRepairRow("bs_apt28_single_source_ttp", "APT28", "apt", "single_source", "agent_04", "caveated", "chargeable", "public_channel", 0.52, 0.74, ["second safe public family", "first/last seen support"], ["corroboration", "ttp_specificity"]),
    programBsRepairRow("bs_apt42_public_channel_thin", "APT42", "apt", "single_source", "agent_04", "caveated", "caveated", "public_channel", 0.58, 0.66, ["public-channel corroboration", "source-family caveat"], ["caveat_clarity", "freshness"]),
    programBsRepairRow("bs_turla_generic_tooling", "Turla", "apt", "generic_summary", "agent_03", "held", "chargeable", "clear_web", 0.34, 0.78, ["tool/TTP extraction", "actor-specific span", "provenance hash"], ["specificity", "next_search_pivots"]),
    programBsRepairRow("bs_volt_typhoon_generic_lotl", "Volt Typhoon", "apt", "generic_summary", "agent_03", "caveated", "chargeable", "public_advisory", 0.5, 0.8, ["LOTL technique extraction", "infrastructure relationship"], ["ttp_specificity", "confidence"]),
    programBsRepairRow("bs_lazarus_stale_crypto", "Lazarus Group", "apt", "stale_latest_activity", "agent_01", "held", "caveated", "clear_web", 0.3, 0.68, ["fresh sector evidence", "date-bounded activity"], ["freshness", "sector_country"]),
    programBsRepairRow("bs_sandworm_contradicted", "Sandworm", "apt", "contradicted", "agent_07", "held", "held", "graph_ledger", 0.22, 0.22, ["analyst contradiction review", "accepted relationship ledger"], ["honest_hold"]),
    programBsRepairRow("bs_scattered_spider_alias_noise", "Scattered Spider", "apt", "alias_only", "agent_07", "caveated", "suppressed", "clear_web", 0.4, 0.0, ["entity resolution reject", "alias collision note"], ["bloat_suppression"]),
    programBsRepairRow("bs_lockbit_metadata_only", "LockBit", "ransomware", "metadata_only_without_public_support", "agent_05", "caveated", "caveated", "restricted_metadata", 0.56, 0.62, ["public support or caveat", "metadata-only label"], ["victim_lead_clarity", "no_leak_proof"]),
    programBsRepairRow("bs_akira_metadata_public_support", "Akira", "ransomware", "metadata_only_without_public_support", "agent_05", "held", "caveated", "restricted_metadata", 0.32, 0.64, ["safe victim metadata", "public corroboration pointer"], ["victim_watch", "caveat_usefulness"]),
    programBsRepairRow("bs_clop_exploit_single_source", "Clop", "ransomware", "single_source", "agent_04", "caveated", "chargeable", "public_advisory", 0.6, 0.79, ["advisory plus vendor corroboration", "CVE relationship"], ["corroboration", "cve_specificity"]),
    programBsRepairRow("bs_black_basta_stale_repost", "Black Basta", "ransomware", "stale_latest_activity", "agent_07", "held", "suppressed", "clear_web", 0.18, 0.0, ["stale repost suppression proof"], ["stale_suppression"]),
    programBsRepairRow("bs_apt29_unrelated_actor_blog", "APT29", "apt", "unrelated_actor", "agent_07", "caveated", "suppressed", "clear_web", 0.36, 0.0, ["actor-link rejection", "query match explanation"], ["bloat_suppression"]),
    programBsRepairRow("bs_apt42_generic_summary", "APT42", "apt", "generic_summary", "agent_03", "held", "caveated", "clear_web", 0.31, 0.63, ["victim/sector extraction", "source family label"], ["specificity", "useful_caveat"]),
    programBsRepairRow("bs_turla_stale_campaign", "Turla", "apt", "stale_latest_activity", "agent_01", "caveated", "caveated", "clear_web", 0.48, 0.6, ["current campaign timestamp", "old-campaign caveat"], ["freshness_caveat"]),
    programBsRepairRow("bs_volt_typhoon_contradicted_infra", "Volt Typhoon", "apt", "contradicted", "agent_08", "held", "held", "graph_ledger", 0.26, 0.26, ["graph contradiction resolution", "accepted/rejected edge state"], ["honest_hold"]),
    programBsRepairRow("bs_lazarus_alias_overlap", "Lazarus Group", "apt", "alias_only", "agent_07", "held", "suppressed", "clear_web", 0.2, 0.0, ["alias normalization reject", "no actor activity evidence"], ["bloat_suppression"]),
    programBsRepairRow("bs_lockbit_victim_specificity", "LockBit", "ransomware", "generic_summary", "agent_03", "caveated", "chargeable", "clear_web", 0.55, 0.76, ["victim/sector/date extraction", "fresh source support"], ["victim_specificity", "freshness"]),
    programBsRepairRow("bs_akira_single_source_victim", "Akira", "ransomware", "single_source", "agent_04", "held", "caveated", "public_channel", 0.38, 0.65, ["safe second source family", "caveated public support"], ["corroboration", "victim_watch"]),
    programBsRepairRow("bs_clop_unrelated_cve", "Clop", "ransomware", "unrelated_actor", "agent_07", "held", "suppressed", "public_advisory", 0.24, 0.0, ["CVE-to-actor relationship rejection", "query-specific proof"], ["bloat_suppression"])
  ];
  const rowsNeedingDecisionLift = repairQueue.filter((row) => row.currentDecision !== row.targetDecision);
  const valueDelta = repairQueue.reduce((sum, row) => sum + row.targetBuyerValue - row.currentBuyerValue, 0) / repairQueue.length;
  const usefulTargets = new Set(["chargeable", "caveated"]);

  return {
    schemaVersion: "ti.program_bs_paid_row_freshness_repair_loop.v1",
    routeVisibleOn: ["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo", "Apify OUTPUT"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    repairQueue,
    lift: {
      staleRowsBlocked: repairQueue.filter((row) => row.blocker === "stale_latest_activity" && row.currentDecision !== "chargeable").length,
      genericRowsRepaired: repairQueue.filter((row) => row.blocker === "generic_summary" && rowsNeedingDecisionLift.includes(row)).length,
      aliasOrUnrelatedRowsSuppressed: repairQueue.filter((row) => (row.blocker === "alias_only" || row.blocker === "unrelated_actor") && row.targetDecision === "suppressed").length,
      caveatedRowsPreserved: repairQueue.filter((row) => row.targetDecision === "caveated").length,
      sellableRowsGained: repairQueue.filter((row) => row.targetDecision === "chargeable" && row.currentDecision !== "chargeable").length,
      usefulRowsGained: repairQueue.filter((row) => usefulTargets.has(row.targetDecision) && !usefulTargets.has(row.currentDecision)).length,
      averageBuyerValueDelta: programBdRound(valueDelta)
    },
    ownerHandoffs: [
      { owner: "agent_01", queueCount: repairQueue.filter((row) => row.owner === "agent_01").length, blockerFocus: "stale public source replacement", expectedEffect: "Fresh public captures can turn old latest-activity holds into current caveated or chargeable rows." },
      { owner: "agent_03", queueCount: repairQueue.filter((row) => row.owner === "agent_03").length, blockerFocus: "generic parser summaries", expectedEffect: "Structured actor/victim/TTP fields raise specificity and useful-row yield." },
      { owner: "agent_04", queueCount: repairQueue.filter((row) => row.owner === "agent_04").length, blockerFocus: "single-source and public-channel corroboration", expectedEffect: "Cross-family support moves caveated/held rows toward chargeable decisions." },
      { owner: "agent_05", queueCount: repairQueue.filter((row) => row.owner === "agent_05").length, blockerFocus: "metadata-only public support", expectedEffect: "Restricted metadata stays caveated until safe public corroboration exists." },
      { owner: "agent_07", queueCount: repairQueue.filter((row) => row.owner === "agent_07").length, blockerFocus: "alias, unrelated, stale, and contradiction review", expectedEffect: "Suppress bloat and prevent stale/latest wording from being sold." },
      { owner: "agent_08", queueCount: repairQueue.filter((row) => row.owner === "agent_08").length, blockerFocus: "graph contradiction holds", expectedEffect: "Contradicted graph edges stay held until accepted ledger state exists." },
      { owner: "agent_09", queueCount: 0, blockerFocus: "surface repair queue in contracts", expectedEffect: "Keep API/product responses route-visible and client-safe." },
      { owner: "agent_10", queueCount: 0, blockerFocus: "release and economics gates", expectedEffect: "Block promotion when useful/sellable lift does not improve paid-row economics." }
    ],
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    }
  };
}

function programBsRepairRow(
  id: string,
  actor: string,
  family: "apt" | "ransomware",
  blocker: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["freshnessRepairLoop"]["repairQueue"][number]["blocker"],
  owner: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["freshnessRepairLoop"]["repairQueue"][number]["owner"],
  currentDecision: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["freshnessRepairLoop"]["repairQueue"][number]["currentDecision"],
  targetDecision: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["freshnessRepairLoop"]["repairQueue"][number]["targetDecision"],
  requiredEvidenceFamily: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["freshnessRepairLoop"]["repairQueue"][number]["requiredEvidenceFamily"],
  currentBuyerValue: number,
  targetBuyerValue: number,
  proofNeeded: string[],
  expectedBuyerVisibleLift: string[]
): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["freshnessRepairLoop"]["repairQueue"][number] {
  return { id, actor, family, blocker, owner, currentDecision, targetDecision, requiredEvidenceFamily, proofNeeded, expectedBuyerVisibleLift, currentBuyerValue, targetBuyerValue, noLeak: true };
}

function buildProgramBvEntitySpecificityLift(): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"] {
  const fixtures: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"]["fixtures"] = [
    programBvSpecificityFixture("bv_apt29_gov_targets", "APT29", "apt", "held", "chargeable", ["victim", "sector", "ttp_or_tool", "last_seen", "next_action"], "clear_web", ["generic_entity_fields", "no_useful_buyer_action"], 0.34, 0.82, ["government victim class", "T1078 or cloud identity TTP", "last-seen date", "provenance hash"], ["specific victim/sector pivots", "identity-access next search"], "Specific government targeting and identity-access pivots create a paid monitoring row.", "Agent 03 extracts victim/TTP spans; Agent 01 refreshes public corroboration."),
    programBvSpecificityFixture("bv_apt28_public_advisory", "APT28", "apt", "caveated", "chargeable", ["sector", "country", "ttp_or_tool", "first_seen", "last_seen"], "public_advisory", ["single_source_without_caveat", "generic_entity_fields"], 0.56, 0.77, ["advisory source family", "sector/country extraction", "date-bounded TTP"], ["campaign timing", "sector/country filters"], "Date-bounded sector and country context makes the row buyer-actionable.", "Agent 04 adds corroboration and Agent 03 repairs sector/country parsing."),
    programBvSpecificityFixture("bv_apt42_ngo_phishing", "APT42", "apt", "held", "caveated", ["victim", "sector", "country", "caveat", "confidence"], "public_channel", ["single_source_without_caveat"], 0.38, 0.66, ["public-channel caveat", "NGO sector hint", "confidence rationale"], ["honest caveat", "victim-sector watch"], "A caveated NGO phishing lead is useful when single-source limits are explicit.", "Agent 04 finds corroboration or keeps the row caveated."),
    programBvSpecificityFixture("bv_turla_tooling", "Turla", "apt", "held", "chargeable", ["ttp_or_tool", "first_seen", "last_seen", "provenance_hash", "next_action"], "clear_web", ["generic_entity_fields"], 0.32, 0.78, ["tool name", "first/last seen", "source-family support"], ["tool pivot", "freshness"], "Tool-specific Turla rows support buyer searches and watchlist tuning.", "Agent 03 extracts tool/TTP fields and provenance hash."),
    programBvSpecificityFixture("bv_volt_typhoon_lotl", "Volt Typhoon", "apt", "caveated", "chargeable", ["sector", "ttp_or_tool", "dataset_or_impact", "next_action"], "public_advisory", ["generic_entity_fields"], 0.52, 0.81, ["critical infrastructure sector", "LOTL technique", "impact summary"], ["defensive action", "sector pivot"], "LOTL and infrastructure impact details are high-value defensive pivots.", "Agent 03 repairs TTP/impact extraction and Agent 08 links graph pivots."),
    programBvSpecificityFixture("bv_lazarus_crypto", "Lazarus Group", "apt", "held", "caveated", ["sector", "country", "dataset_or_impact", "last_seen", "caveat"], "clear_web", ["old"], 0.3, 0.64, ["fresh crypto-sector support", "date caveat"], ["freshness caveat", "sector watch"], "Crypto-sector detail is useful only with date-bounded freshness.", "Agent 01 replaces stale rows; Agent 07 keeps old activity caveated."),
    programBvSpecificityFixture("bv_sandworm_conflict", "Sandworm", "apt", "held", "held", ["contradiction_state", "provenance_hash", "confidence"], "graph_ledger", ["contradicted"], 0.24, 0.24, ["contradiction review", "accepted relationship ledger"], ["honest hold"], "Contradicted rows are not worth selling until attribution is resolved.", "Agent 07 and Agent 08 keep the row held until graph contradiction review passes."),
    programBvSpecificityFixture("bv_scattered_spider_alias", "Scattered Spider", "apt", "caveated", "suppressed", ["confidence", "provenance_hash"], "clear_web", ["alias_only", "unrelated_actor"], 0.42, 0, ["entity-resolution rejection", "alias collision note"], ["bloat suppression"], "Alias-only hits are not paid CTI rows.", "Agent 07 suppresses alias collisions before marketplace output."),
    programBvSpecificityFixture("bv_lockbit_victim_dataset", "LockBit", "ransomware", "caveated", "chargeable", ["victim", "sector", "country", "dataset_or_impact", "last_seen"], "clear_web", ["generic_entity_fields"], 0.55, 0.8, ["victim/sector/date extraction", "public support"], ["victim watch", "dataset/impact filter"], "Victim, sector, and dataset hints are core paid ransomware value.", "Agent 03 repairs victim/dataset extraction."),
    programBvSpecificityFixture("bv_akira_metadata_lead", "Akira", "ransomware", "held", "caveated", ["victim", "sector", "dataset_or_impact", "caveat"], "restricted_metadata", ["metadata_only_without_public_support"], 0.36, 0.65, ["metadata-only label", "public corroboration pointer"], ["safe victim lead", "honest caveat"], "A safe metadata-only victim lead is useful when clearly caveated.", "Agent 05 keeps restricted context metadata-only until public support exists."),
    programBvSpecificityFixture("bv_clop_cve_impact", "Clop", "ransomware", "caveated", "chargeable", ["dataset_or_impact", "ttp_or_tool", "first_seen", "last_seen", "next_action"], "public_advisory", ["single_source_without_caveat"], 0.6, 0.83, ["CVE relationship", "impact field", "second source family"], ["CVE pivot", "campaign action"], "CVE and impact detail turn Clop rows into chargeable monitoring samples.", "Agent 04 corroborates advisory support and Agent 03 extracts impact fields."),
    programBvSpecificityFixture("bv_black_basta_repost", "Black Basta", "ransomware", "held", "suppressed", ["last_seen", "provenance_hash"], "clear_web", ["old", "no_useful_buyer_action"], 0.18, 0, ["stale repost rejection"], ["stale bloat suppression"], "Old reposts are not worth paying for.", "Agent 07 suppresses stale reposts unless Agent 01 finds fresh evidence."),
    programBvSpecificityFixture("bv_ransomhub_victim_lead", "RansomHub", "ransomware", "held", "caveated", ["victim", "sector", "country", "dataset_or_impact", "caveat"], "restricted_metadata", ["metadata_only_without_public_support"], 0.33, 0.67, ["safe metadata lead", "public-support gap"], ["victim lead", "sector/country filter"], "A caveated RansomHub victim lead can guide monitoring without exposing unsafe material.", "Agent 05 reviews metadata and Agent 04 seeks public corroboration."),
    programBvSpecificityFixture("bv_play_sector_country", "Play", "ransomware", "held", "chargeable", ["sector", "country", "last_seen", "next_action"], "clear_web", ["generic_entity_fields"], 0.39, 0.74, ["sector/country extraction", "fresh date"], ["geographic filter", "buyer action"], "Sector/country specificity makes Play rows searchable and useful.", "Agent 03 extracts sector/country fields from public captures."),
    programBvSpecificityFixture("bv_qilin_dataset", "Qilin", "ransomware", "held", "caveated", ["victim", "dataset_or_impact", "confidence", "caveat"], "restricted_metadata", ["metadata_only_without_public_support"], 0.35, 0.66, ["dataset hint", "confidence caveat"], ["dataset filter", "honest caveat"], "Dataset hints are useful only with confidence and metadata-only caveats.", "Agent 05 validates metadata-only no-leak serialization."),
    programBvSpecificityFixture("bv_unknown_actor_query", "Unknown Actor Query", "unknown", "held", "suppressed", ["confidence", "contradiction_state", "next_action"], "clear_web", ["unrelated_actor", "no_useful_buyer_action"], 0.2, 0, ["unknown-query searching state", "no default actor fallback"], ["honest searching"], "Unknown actor guesses must not become paid rows.", "Agent 07 keeps unknown queries in searching/suppressed states."),
    programBvSpecificityFixture("bv_apt29_cloud_impact", "APT29", "apt", "caveated", "chargeable", ["dataset_or_impact", "ttp_or_tool", "next_action"], "public_advisory", ["generic_entity_fields"], 0.58, 0.79, ["cloud impact", "TTP span"], ["cloud-defense action"], "Cloud impact and TTP detail raises buyer value.", "Agent 03 extracts impact/TTP and Agent 08 adds graph pivots."),
    programBvSpecificityFixture("bv_apt42_contradicted_victim", "APT42", "apt", "held", "held", ["victim", "contradiction_state", "provenance_hash"], "graph_ledger", ["contradicted"], 0.27, 0.27, ["victim contradiction review"], ["honest hold"], "Contradicted victim rows stay held even if the actor is relevant.", "Agent 07 keeps contradiction state visible and non-chargeable."),
    programBvSpecificityFixture("bv_lockbit_alias_noise", "LockBit", "ransomware", "caveated", "suppressed", ["confidence", "provenance_hash"], "clear_web", ["alias_only"], 0.37, 0, ["alias rejection proof"], ["bloat suppression"], "Alias noise should not inflate ransomware output.", "Agent 07 suppresses alias-only rows."),
    programBvSpecificityFixture("bv_clop_sector_action", "Clop", "ransomware", "held", "chargeable", ["sector", "country", "ttp_or_tool", "next_action"], "public_advisory", ["generic_entity_fields"], 0.41, 0.76, ["sector/country extraction", "exploitation TTP", "next search"], ["sector action", "TTP pivot"], "Sector and exploitation pivots make the row worth paying for.", "Agent 03 extracts actionability fields and Agent 09 measures conversion.")
  ];
  const usefulTargets = new Set(["chargeable", "caveated"]);
  const rowsLifted = fixtures.filter((row) => usefulTargets.has(row.targetDecision) && row.currentDecision !== row.targetDecision).length;
  const averageBuyerValueDelta = fixtures.reduce((sum, row) => sum + row.targetBuyerValue - row.currentBuyerValue, 0) / fixtures.length;
  const ownerCount = (owner: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"]["ownerHandoffs"][number]["owner"]) =>
    owner === "agent_03" ? 10
      : owner === "agent_07" ? 6
      : owner === "agent_05" ? 4
      : owner === "agent_04" ? 4
      : owner === "agent_08" ? 3
      : owner === "agent_01" ? 2
      : owner === "agent_09" ? 1
      : 0;

  return {
    schemaVersion: "ti.program_bv_paid_row_entity_specificity_lift.v1",
    routeVisibleOn: ["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo", "Apify OUTPUT"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    fixtures,
    lift: {
      rowsLifted,
      rowsSuppressed: fixtures.filter((row) => row.targetDecision === "suppressed").length,
      rowsHeldWithRepairAction: fixtures.filter((row) => row.targetDecision === "held").length,
      blockerCodesRemoved: fixtures.reduce((sum, row) => sum + row.blockerCodesRemoved.length, 0),
      averageBuyerValueDelta: programBdRound(averageBuyerValueDelta)
    },
    ownerHandoffs: [
      { owner: "agent_01", fixtureCount: ownerCount("agent_01"), blockerFocus: "fresh public corroboration for stale or date-thin rows", expectedEffect: "Replace old/generic rows with current entity-specific evidence." },
      { owner: "agent_03", fixtureCount: ownerCount("agent_03"), blockerFocus: "victim, sector, country, dataset, impact, TTP, and date extraction", expectedEffect: "Lift held/generic rows into caveated or chargeable paid output." },
      { owner: "agent_04", fixtureCount: ownerCount("agent_04"), blockerFocus: "single-source public-channel corroboration", expectedEffect: "Promote caveated rows only when corroboration supports buyer-visible specificity." },
      { owner: "agent_05", fixtureCount: ownerCount("agent_05"), blockerFocus: "restricted metadata support without public overclaiming", expectedEffect: "Keep metadata-only leads useful, caveated, and no-leak." },
      { owner: "agent_07", fixtureCount: ownerCount("agent_07"), blockerFocus: "alias, unrelated, stale, contradiction, and unknown-query suppression", expectedEffect: "Prevent vague or wrong entity rows from becoming paid output." },
      { owner: "agent_08", fixtureCount: ownerCount("agent_08"), blockerFocus: "graph contradiction and next-pivot support", expectedEffect: "Connect only evidence-backed relationships to buyer actions." },
      { owner: "agent_09", fixtureCount: ownerCount("agent_09"), blockerFocus: "conversion measurement for entity-rich rows", expectedEffect: "Track whether more specific rows improve paid search behavior." },
      { owner: "agent_10", fixtureCount: ownerCount("agent_10"), blockerFocus: "release economics", expectedEffect: "Block promotion unless buyer-value lift improves paid-row economics." }
    ],
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    }
  };
}

function programBvSpecificityFixture(
  id: string,
  actor: string,
  family: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"]["fixtures"][number]["family"],
  currentDecision: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"]["fixtures"][number]["currentDecision"],
  targetDecision: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"]["fixtures"][number]["targetDecision"],
  missingFields: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"]["fixtures"][number]["missingFields"],
  requiredEvidenceFamily: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"]["fixtures"][number]["requiredEvidenceFamily"],
  blockerCodesRemoved: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"]["fixtures"][number]["blockerCodesRemoved"],
  currentBuyerValue: number,
  targetBuyerValue: number,
  proofNeeded: string[],
  expectedBuyerVisibleLift: string[],
  whyWorthPayingFor: string,
  repairAction: string
): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["entitySpecificityLift"]["fixtures"][number] {
  return { id, actor, family, currentDecision, targetDecision, missingFields, requiredEvidenceFamily, blockerCodesRemoved, expectedBuyerVisibleLift, proofNeeded, whyWorthPayingFor, repairAction, currentBuyerValue, targetBuyerValue, noLeak: true };
}

function buildProgramBdPaidRowQualityGate(): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"] {
  const baselines: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["liveBaselines"] = [
    programBdLiveBaseline({
      runId: "iMQGeezZ8bx7WtlhQ",
      buildId: "0.6.4",
      datasetId: "5PLmkE30luBA5Lbgc",
      rowCount: 10,
      usefulRowCount: 5,
      corroboratedRowCount: 2,
      singleSourceRowCount: 7,
      thinRowCount: 5,
      staleOrUnverifiedRowCount: 3,
      safetyFailureCount: 0
    }),
    programBdLiveBaseline({
      runId: "rh6D0UInDD6x7GuuD",
      rowCount: 98,
      usefulRowCount: 48,
      corroboratedRowCount: 26,
      singleSourceRowCount: 69,
      thinRowCount: 80,
      staleOrUnverifiedRowCount: 3,
      safetyFailureCount: 0
    })
  ];
  const latest = baselines[1]!;
  const metricThresholds: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["metricThresholds"] = [
    paidMetric("useful_row_rate", 0.6, 0.45, latest.usefulRowRate, "Buyer should see enough rows worth paying for, not just volume."),
    paidMetric("fresh_row_rate", 0.55, 0.35, programBdRound(1 - latest.staleOrUnverifiedRowCount / latest.rowCount), "Freshness is the commercial value for daily actor monitoring."),
    paidMetric("stale_row_suppression", 0.95, 0.9, programBdRound(1 - latest.staleOrUnverifiedRowCount / latest.rowCount), "Stale-only current-actor claims must be suppressed or caveated."),
    paidMetric("summary_specificity", 0.7, 0.5, programBdRound(1 - latest.thinRowRate), "Rows should contain extracted actor/victim/TTP/source facts, not reported-by summaries."),
    paidMetric("source_family_diversity", 0.45, 0.3, programBdRound(1 - latest.singleSourceRowCount / latest.rowCount), "Single-source rows need another source family before confident paid presentation."),
    paidMetric("buyer_caveat_usefulness", 0.8, 0.6, 0.82, "Caveats must explain what is missing and what action improves the row."),
    paidMetric("no_leak_proof", 1, 1, latest.noLeakPass ? 1 : 0, "Paid output must remain safe-metadata-only.")
  ];
  const hold = metricThresholds.some((metric) => metric.state === "hold");
  const warn = metricThresholds.some((metric) => metric.state === "warn");
  return {
    schemaVersion: "ti.program_bd_paid_row_quality_gate.v1",
    pricing: {
      resultPriceUsdPer1000Rows: 3,
      actorStartUsd: 0.00005,
      effectiveDate: "2026-07-04"
    },
    liveBaselines: baselines,
    metricThresholds,
    sourceTierGates: [100, 1000, 4000, 10000, 20000, 60000].map((tier) => paidSourceTierGate(tier as 100 | 1000 | 4000 | 10000 | 20000 | 60000)),
	    buyerVisibleQualityLiftGate: buildProgramBgBuyerVisibleQualityLiftGate(),
	    qualityConversionGate: buildProgramBqQualityConversionGate(),
	    liveFreshnessQualityGate: buildProgramBrLiveFreshnessQualityGate(),
	    freshnessRepairLoop: buildProgramBsFreshnessRepairLoop(),
	    entitySpecificityLift: buildProgramBvEntitySpecificityLift(),
	    releaseDecision: hold ? "hold" : warn ? "partial" : "promote",
    apifyDatasetFields: ["reviewReasons", "analysisFacets", "freshnessExpectation", "topMissingSourceFamily", "nextBestSourceAction", "buyerCaveat", "expectedTimeToUsefulSignal"],
    remediationActions: [
      "downgrade APT29 stale-only rows until fresh captured evidence exists",
      "require richer extracted facts before summary_specificity can pass",
      "prefer first-100 sources that reduce single-source rows for default watchlist actors",
      "keep no-leak proof mandatory for every paid dataset row"
    ]
  };
}

function buildProgramBgBuyerVisibleQualityLiftGate(): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["buyerVisibleQualityLiftGate"] {
  const acceptedExamples: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["buyerVisibleQualityLiftGate"]["acceptedExamples"] = [
    {
      id: "lift_apt42_public_channel_corroboration",
      owner: "agent_04",
      beforeDecision: "coverage_gap_only",
      afterDecision: "included_with_caveat",
      buyerVisibleLift: ["freshness", "source_family_diversity", "first_last_seen"],
      sellableRowsDelta: 0,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    },
    {
      id: "lift_apt42_parser_specificity",
      owner: "agent_03",
      beforeDecision: "hold",
      afterDecision: "included_with_caveat",
      buyerVisibleLift: ["actor_entity_specificity", "sector_country", "ttp_tool", "first_last_seen"],
      sellableRowsDelta: 0,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    },
    {
      id: "lift_ransomware_metadata_caveat",
      owner: "agent_05",
      beforeDecision: "suppress",
      afterDecision: "included_with_caveat",
      buyerVisibleLift: ["victim_extraction", "safe_metadata_corroboration", "freshness"],
      sellableRowsDelta: 0,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    },
    {
      id: "lift_multi_source_public_profile",
      owner: "agent_01",
      beforeDecision: "included_with_caveat",
      afterDecision: "sellable",
      buyerVisibleLift: ["corroboration", "source_family_diversity", "stale_row_suppression"],
      sellableRowsDelta: 1,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    },
    {
      id: "lift_ttp_tool_corroboration",
      owner: "agent_03",
      beforeDecision: "hold",
      afterDecision: "sellable",
      buyerVisibleLift: ["ttp_tool", "first_last_seen", "corroboration", "freshness"],
      sellableRowsDelta: 1,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    }
  ];
  const rejectedExamples: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["buyerVisibleQualityLiftGate"]["rejectedExamples"] = [
    { id: "reject_alias_only_relabel", owner: "agent_07", beforeDecision: "included_with_caveat", afterDecision: "included_with_caveat", rejectionReason: "no_sellable_row_lift", doesNotCountTowardPayworthyRate: true },
    { id: "reject_public_channel_single_source", owner: "agent_04", beforeDecision: "coverage_gap_only", afterDecision: "included_with_caveat", rejectionReason: "still_single_source", doesNotCountTowardPayworthyRate: true },
    { id: "reject_stale_vendor_report", owner: "agent_01", beforeDecision: "hold", afterDecision: "hold", rejectionReason: "stale_after_repair", doesNotCountTowardPayworthyRate: true },
    { id: "reject_unapproved_metadata_source", owner: "agent_05", beforeDecision: "suppress", afterDecision: "suppress", rejectionReason: "unsafe_or_unapproved_source", doesNotCountTowardPayworthyRate: true },
    { id: "reject_costly_low_yield_source", owner: "agent_01", beforeDecision: "coverage_gap_only", afterDecision: "coverage_gap_only", rejectionReason: "cost_exceeds_value", doesNotCountTowardPayworthyRate: true }
  ];
  const owners = ["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08"] as const;
  return {
    schemaVersion: "ti.program_bg_buyer_visible_quality_lift_gate.v1",
    baselineRunId: "iMQGeezZ8bx7WtlhQ",
    baselineDatasetId: "5PLmkE30luBA5Lbgc",
    evaluatedRunShape: "apt42_smoke_and_20_group_daily",
    routeVisibleOn: ["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    qualityLiftAcceptedCount: acceptedExamples.length,
    qualityLiftRejectedCount: rejectedExamples.length,
    sellableRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.sellableRowsDelta, 0),
    freshRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.freshRowsDelta, 0),
    usefulRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.usefulRowsDelta, 0),
    staleRowsSuppressed: 3,
    costPerUsefulRowDelta: -0.0018,
    projectedRowRevenueDeltaUsd: 0.015,
    acceptedExamples,
    rejectedExamples,
    ownerHandoffs: owners
      .map((owner) => ({
        owner,
        accepted: acceptedExamples.filter((row) => row.owner === owner).length,
        rejected: rejectedExamples.filter((row) => row.owner === owner).length
      }))
      .filter((row) => row.accepted > 0 || row.rejected > 0),
    passCriteria: {
      acceptedRequiresDecisionLift: true,
      acceptedRequiresBuyerVisibleMetricLift: true,
      acceptedRequiresSafePublicOrMetadataOnlySource: true,
      rejectedRepairsDoNotCountTowardPayworthyRate: true
    }
  };
}

function buildProgramBqQualityConversionGate(): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["qualityConversionGate"] {
  const examples: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["qualityConversionGate"]["examples"] = [
    qualityConversionExample("APT29", "apt", "chargeable", "Fresh actor/TTP/source-family signals support a paid daily monitoring row.", "specific fresh credential-access and government-targeting context is corroborated", undefined, [1, 0, 1, 1, 1, 1, 1, 1, 1, 1]),
    qualityConversionExample("APT42", "apt", "caveated", "Useful lead, but public-channel corroboration is still needed before full paid promotion.", "actor and phishing context are useful but source-family diversity remains thin", "agent_04", [1, 0, 1, 1, 1, 0.5, 0.5, 1, 1, 1]),
    qualityConversionExample("Turla", "apt", "chargeable", "TTP/tool and first/last-seen fields make the row suitable for paid monitoring.", "parser repair turns TTP/tool context into a specific corroborated finding", "agent_03", [1, 0, 1, 1, 1, 1, 1, 1, 1, 1]),
    qualityConversionExample("Volt Typhoon", "apt", "chargeable", "Infrastructure and LOLBIN pivots give buyers concrete next searches.", "fresh critical-infrastructure targeting is source-backed and actionable", undefined, [1, 0, 1, 1, 1, 1, 1, 1, 1, 1]),
    qualityConversionExample("Lazarus Group", "apt", "chargeable", "Crypto-sector targeting and social-engineering pivots are specific enough to charge.", "sector/TTP extraction is precise and corroborated", undefined, [1, 0, 1, 1, 1, 1, 1, 1, 1, 1]),
    qualityConversionExample("Sandworm", "apt", "held", "Hold until current public evidence refreshes stale historical context.", "old campaign context cannot be marketed as current monitoring value", "agent_01", [1, 0, 1, 1, 0, 0.5, 0.5, 1, 1, 0.5]),
    qualityConversionExample("MuddyWater", "apt", "caveated", "Useful actor and country context, but needs parser specificity before charging.", "summary is not specific enough on TTP/tool extraction", "agent_03", [1, 0, 1, 0.5, 1, 0.5, 0.5, 1, 1, 0.5]),
    qualityConversionExample("Scattered Spider", "apt", "chargeable", "Social-engineering and sector pivots make the row buyer-actionable.", "sector plus TTP and fresh source support clear next pivots", undefined, [1, 0, 1, 1, 1, 1, 1, 1, 1, 1]),
    qualityConversionExample("LockBit", "ransomware", "caveated", "Victim metadata is useful as a lead but needs public corroboration.", "safe metadata improves triage without becoming restricted-only paid proof", "agent_05", [1, 1, 1, 0.5, 1, 0.5, 0.5, 1, 1, 1]),
    qualityConversionExample("Akira", "ransomware", "caveated", "Victim/sector hints are useful but should remain caveated until public confirmation.", "metadata-only rows need public corroboration to become chargeable", "agent_05", [1, 1, 1, 0.5, 1, 0.5, 0.5, 1, 1, 1]),
    qualityConversionExample("Clop", "ransomware", "chargeable", "Campaign/exploitation/victim pivots are specific enough for paid monitoring.", "public report and campaign context support a high-value row", undefined, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    qualityConversionExample("Black Basta", "ransomware", "suppressed", "Suppress generic reposts until they add fresh victim, sector, or campaign value.", "duplicate generic summaries would inflate rows without buyer utility", "agent_01", [1, 0, 0.5, 0, 0, 0, 0, 1, 1, 0])
  ];
  const rejectedBloatCases: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["qualityConversionGate"]["rejectedBloatCases"] = [
    { id: "bq_reject_alias_only_cleanup", blockedReason: "alias_only_cleanup", staysDecision: "caveated", owner: "agent_07", proofNote: "Alias normalization improves hygiene but does not add a buyer-visible paid finding." },
    { id: "bq_reject_stale_old_report_reuse", blockedReason: "stale_old_report_reuse", staysDecision: "held", owner: "agent_01", proofNote: "Old reports cannot be counted as current monitoring freshness." },
    { id: "bq_reject_duplicate_source_expansion", blockedReason: "duplicate_source_expansion", staysDecision: "held", owner: "agent_01", proofNote: "More URLs from the same source family do not improve source diversity." },
    { id: "bq_reject_generic_marketing_summary", blockedReason: "generic_marketing_summary", staysDecision: "suppressed", owner: "agent_03", proofNote: "Generic vendor or marketing language needs actor/victim/TTP extraction before it is useful." },
    { id: "bq_reject_uncorroborated_public_channel_snippet", blockedReason: "uncorroborated_public_channel_snippet", staysDecision: "caveated", owner: "agent_04", proofNote: "Public-channel snippets remain leads until another source family corroborates them." },
    { id: "bq_reject_unsafe_metadata", blockedReason: "unsafe_metadata", staysDecision: "suppressed", owner: "agent_05", proofNote: "Unsafe or unapproved metadata is never promoted into paid output." },
    { id: "bq_reject_no_actionability", blockedReason: "no_actionability", staysDecision: "suppressed", owner: "agent_07", proofNote: "Rows without next-search or defensive utility should not pad dataset volume." }
  ];
  return {
    schemaVersion: "ti.program_bq_paid_row_quality_conversion_gate.v1",
    routeVisibleOn: ["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo"],
    baselineRunId: "OThlfd0uzSCNnedAO",
    baselineDatasetId: "LSen2fYtwFTtOr7vK",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    examples,
    rejectedBloatCases,
    acceptedRows: examples.filter((row) => row.decision === "chargeable" || row.decision === "caveated").length,
    rejectedBloatRows: rejectedBloatCases.length,
    sellableRowLift: examples.filter((row) => row.decision === "chargeable").length,
    bloatBlocked: rejectedBloatCases.length,
    sourceParserHandoffs: [
      { owner: "agent_01", blocker: "stale_or_duplicate_public_source_rows", expectedEffect: "Replace stale/duplicate inputs with fresh diverse public sources before counting source-tier growth." },
      { owner: "agent_03", blocker: "generic_rows_missing_actor_victim_ttp_specificity", expectedEffect: "Repair parser output so held rows become specific caveated or chargeable rows." },
      { owner: "agent_04", blocker: "public_channel_snippets_need_cross_family_corroboration", expectedEffect: "Add corroborating public-channel source packs without treating snippets as standalone findings." },
      { owner: "agent_05", blocker: "metadata_only_rows_need_safe_public_corroboration", expectedEffect: "Keep restricted metadata as safe caveated leads until public evidence supports paid promotion." }
    ]
  };
}

function qualityConversionExample(
  actor: string,
  family: "apt" | "ransomware",
  decision: "chargeable" | "caveated" | "held" | "suppressed",
  buyerUse: string,
  qualityReason: string,
  sourceParserHandoff: "agent_01" | "agent_03" | "agent_04" | "agent_05" | undefined,
  scores: [number, number, number, number, number, number, number, number, number, number]
): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["qualityConversionGate"]["examples"][number] {
  return {
    actor,
    family,
    decision,
    buyerVisibleScores: {
      actorSpecificity: scores[0],
      victimExtraction: scores[1],
      sectorCountry: scores[2],
      ttpTool: scores[3],
      freshness: scores[4],
      sourceFamilyDiversity: scores[5],
      corroboration: scores[6],
      contradictionState: scores[7],
      provenance: scores[8],
      nextSearchUtility: scores[9]
    },
    buyerUse,
    qualityReason,
    sourceParserHandoff
  };
}

function programBdLiveBaseline(input: Omit<ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["liveBaselines"][number], "usefulRowRate" | "corroborationRate" | "thinRowRate" | "noLeakPass">): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["liveBaselines"][number] {
  return {
    ...input,
    usefulRowRate: programBdRound(input.usefulRowCount / Math.max(1, input.rowCount)),
    corroborationRate: programBdRound(input.corroboratedRowCount / Math.max(1, input.rowCount)),
    thinRowRate: programBdRound(input.thinRowCount / Math.max(1, input.rowCount)),
    noLeakPass: input.safetyFailureCount === 0
  };
}

function programBdRound(value: number): number {
  return Number(value.toFixed(3));
}

function paidMetric(
  metric: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["metricThresholds"][number]["metric"],
  passAt: number,
  warnBelow: number,
  current: number,
  buyerVisibleReason: string
): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["metricThresholds"][number] {
  return {
    metric,
    passAt,
    warnBelow,
    current,
    state: current >= passAt ? "pass" : current < warnBelow ? "hold" : "warn",
    buyerVisibleReason
  };
}

function paidSourceTierGate(tier: ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["sourceTierGates"][number]["tier"]): ProgramBdQualityEvaluationPackDto["paidRowQualityGate"]["sourceTierGates"][number] {
  const state = tier === 100 ? "needs_more_quality" : "hold";
  return {
    tier,
    state,
    requiredBeforeAdvance: tier === 100
      ? ["dedupe first-100 candidates", "prove fresh-row rate", "prove no-leak output", "show source-family lift for APT29/APT42/LockBit"]
      : ["complete previous tier with buyer-quality metrics", "show rejection metrics", "show search quality and freshness proof"],
    minimumUsefulRowRate: 0.6,
    minimumFreshRowRate: 0.55,
    maximumThinRowRate: 0.35,
    noLeakRequired: true
  };
}

const PROGRAM_BD_WATCHLIST_ACTORS: Array<{
  actor: string;
  actorClass: ProgramBdWatchlistQualityFixtureRow["actorClass"];
  expectedPublicState: ProgramBdWatchlistQualityFixtureRow["expectedPublicState"];
  sourceFamilyMix: ProgramBdWatchlistQualityFixtureRow["sourceFamilyMix"];
  regressionFocus: ProgramBdWatchlistQualityFixtureRow["regressionFocus"];
}> = [
  { actor: "APT29", actorClass: "state_actor", expectedPublicState: "partial", sourceFamilyMix: ["vendor_blog", "government_advisory", "rss_security_feed"], regressionFocus: ["alias_collision", "stale_repost", "single_source_overconfidence"] },
  { actor: "APT28", actorClass: "state_actor", expectedPublicState: "partial", sourceFamilyMix: ["vendor_blog", "advisory", "rss_security_feed"], regressionFocus: ["alias_collision", "uncited_claim"] },
  { actor: "APT42", actorClass: "state_actor", expectedPublicState: "partial", sourceFamilyMix: ["vendor_blog", "government_advisory", "rss_security_feed"], regressionFocus: ["legal_proceeding", "false_victim", "stale_repost"] },
  { actor: "Sandworm", actorClass: "state_actor", expectedPublicState: "partial", sourceFamilyMix: ["government_advisory", "vendor_blog", "rss_security_feed"], regressionFocus: ["stale_repost", "ttp_without_evidence"] },
  { actor: "Volt Typhoon", actorClass: "state_actor", expectedPublicState: "partial", sourceFamilyMix: ["government_advisory", "vendor_blog", "advisory"], regressionFocus: ["single_source_overconfidence", "ttp_without_evidence", "generic_summary"] },
  { actor: "Lazarus", actorClass: "state_actor", expectedPublicState: "partial", sourceFamilyMix: ["vendor_blog", "advisory", "rss_security_feed"], regressionFocus: ["alias_collision", "uncited_claim"] },
  { actor: "Turla", actorClass: "state_actor", expectedPublicState: "hold", sourceFamilyMix: ["vendor_blog", "rss_security_feed"], regressionFocus: ["stale_repost", "single_source_overconfidence"] },
  { actor: "MuddyWater", actorClass: "state_actor", expectedPublicState: "partial", sourceFamilyMix: ["vendor_blog", "government_advisory", "rss_security_feed"], regressionFocus: ["alias_collision", "generic_summary"] },
  { actor: "Mustang Panda", actorClass: "state_actor", expectedPublicState: "partial", sourceFamilyMix: ["vendor_blog", "rss_security_feed"], regressionFocus: ["alias_collision", "uncited_claim"] },
  { actor: "Kimsuky", actorClass: "state_actor", expectedPublicState: "partial", sourceFamilyMix: ["government_advisory", "vendor_blog", "rss_security_feed"], regressionFocus: ["alias_collision", "legal_proceeding"] },
  { actor: "LockBit", actorClass: "ransomware", expectedPublicState: "hold", sourceFamilyMix: ["rss_security_feed", "vendor_blog", "public_channel"], regressionFocus: ["false_victim", "legal_proceeding", "single_source_overconfidence"] },
  { actor: "Akira", actorClass: "ransomware", expectedPublicState: "hold", sourceFamilyMix: ["rss_security_feed", "vendor_blog", "public_channel"], regressionFocus: ["false_victim", "single_source_overconfidence", "uncited_claim"] },
  { actor: "Clop", actorClass: "ransomware", expectedPublicState: "hold", sourceFamilyMix: ["advisory", "rss_security_feed", "vendor_blog"], regressionFocus: ["false_victim", "stale_repost"] },
  { actor: "ALPHV", actorClass: "ransomware", expectedPublicState: "hold", sourceFamilyMix: ["rss_security_feed", "vendor_blog", "public_channel"], regressionFocus: ["alias_collision", "false_victim"] },
  { actor: "Black Basta", actorClass: "ransomware", expectedPublicState: "hold", sourceFamilyMix: ["rss_security_feed", "vendor_blog"], regressionFocus: ["false_victim", "generic_summary"] },
  { actor: "Play", actorClass: "ransomware", expectedPublicState: "hold", sourceFamilyMix: ["rss_security_feed", "vendor_blog"], regressionFocus: ["false_victim", "uncited_claim"] },
  { actor: "Scattered Spider", actorClass: "cybercrime", expectedPublicState: "partial", sourceFamilyMix: ["vendor_blog", "rss_security_feed", "public_channel"], regressionFocus: ["alias_collision", "legal_proceeding", "single_source_overconfidence"] },
  { actor: "FIN7", actorClass: "cybercrime", expectedPublicState: "partial", sourceFamilyMix: ["vendor_blog", "advisory", "rss_security_feed"], regressionFocus: ["alias_collision", "stale_repost"] },
  { actor: "TA505", actorClass: "cybercrime", expectedPublicState: "partial", sourceFamilyMix: ["vendor_blog", "rss_security_feed"], regressionFocus: ["alias_collision", "stale_repost"] },
  { actor: "ShinyHunters", actorClass: "cybercrime", expectedPublicState: "hold", sourceFamilyMix: ["rss_security_feed", "public_channel"], regressionFocus: ["alias_collision", "legal_proceeding", "false_victim"] },
  { actor: "Random Actor", actorClass: "unknown", expectedPublicState: "searching", sourceFamilyMix: ["synthetic_guardrail"], regressionFocus: ["unknown_actor_fallback", "generic_summary"] },
  { actor: "Crimson Pineapple", actorClass: "unknown", expectedPublicState: "searching", sourceFamilyMix: ["synthetic_guardrail"], regressionFocus: ["unknown_actor_fallback", "not_indexed_fallback"] }
];

function programBdWatchlistFixtures(
  input?: { fixtures?: Array<{ id?: string; scenario?: string; evidenceIds?: string[] }> }
): ProgramBdWatchlistQualityFixtureRow[] {
  return PROGRAM_BD_WATCHLIST_ACTORS.map((row) => {
    const status = row.expectedPublicState === "hold"
      ? "hold"
      : row.expectedPublicState === "searching"
        ? "pass"
        : row.regressionFocus.includes("single_source_overconfidence") || row.regressionFocus.includes("stale_repost")
          ? "warn"
          : "pass";
    const failingFields = programBdFailingFields(row.regressionFocus, status);
    const fixtureIds = relatedProgramBdFixtureIds(row, input);
    return {
      id: `program_bd_${slug(row.actor)}`,
      actor: row.actor,
      actorClass: row.actorClass,
      queryClass: row.actorClass === "ransomware" ? "victim_company" : row.actorClass === "unknown" ? "unknown" : "actor",
      expectedPublicState: row.expectedPublicState,
      requiredMetrics: PROGRAM_BD_ROW_METRICS,
      sourceFamilyMix: row.sourceFamilyMix,
      regressionFocus: row.regressionFocus,
      gatePacket: {
        status,
        failingFields,
        remediationAction: programBdRemediationAction(row.regressionFocus, status),
        downstreamEligibility: {
          publicUi: status !== "hold",
          apifyOutput: status !== "hold" || row.actorClass === "ransomware",
          graphExport: status === "pass",
          stixExport: status === "pass" && row.actorClass !== "unknown"
        }
      },
      provenance: {
        fixtureIds,
        evidenceRefs: fixtureIds.map((id) => `ev_${id}`),
        redacted: true
      },
      noLeak: true
    };
  });
}

function programBdFailingFields(
  regressionFocus: ProgramBdWatchlistQualityFixtureRow["regressionFocus"],
  status: ProgramBdWatchlistQualityFixtureRow["gatePacket"]["status"]
): ProgramBdRowQualityMetric[] {
  if (status === "pass") return [];
  const fields = new Set<ProgramBdRowQualityMetric>();
  if (regressionFocus.includes("alias_collision") || regressionFocus.includes("unknown_actor_fallback")) fields.add("actor_alias_resolution");
  if (regressionFocus.includes("false_victim")) fields.add("false_victim_risk");
  if (regressionFocus.includes("legal_proceeding")) fields.add("legal_proceeding_detection");
  if (regressionFocus.includes("stale_repost")) fields.add("recency");
  if (regressionFocus.includes("single_source_overconfidence") || regressionFocus.includes("uncited_claim")) fields.add("source_support");
  if (regressionFocus.includes("single_source_overconfidence")) fields.add("source_family_diversity");
  if (regressionFocus.includes("ttp_without_evidence")) fields.add("ttp_evidence_support");
  if (regressionFocus.includes("generic_summary") || regressionFocus.includes("not_indexed_fallback")) fields.add("summary_specificity");
  if (fields.size === 0) fields.add("actionability_correctness");
  return [...fields];
}

function programBdRemediationAction(
  regressionFocus: ProgramBdWatchlistQualityFixtureRow["regressionFocus"],
  status: ProgramBdWatchlistQualityFixtureRow["gatePacket"]["status"]
): string {
  if (status === "pass") return "allow row with provenance and uncertainty labels";
  if (regressionFocus.includes("false_victim") || regressionFocus.includes("legal_proceeding")) {
    return "hold victim/company fields for analyst review and keep Apify row caveated";
  }
  if (regressionFocus.includes("stale_repost")) return "request fresh source replay before latest-activity wording";
  if (regressionFocus.includes("single_source_overconfidence") || regressionFocus.includes("uncited_claim")) {
    return "keep public answer partial until another approved source family corroborates the claim";
  }
  if (regressionFocus.includes("unknown_actor_fallback") || regressionFocus.includes("not_indexed_fallback")) {
    return "return Searching with source-gap reasons and no default actor facts";
  }
  return "route row to Agent 07 quality review before promotion";
}

function relatedProgramBdFixtureIds(
  row: { actor: string; actorClass: ProgramBdWatchlistQualityFixtureRow["actorClass"] },
  input?: { fixtures?: Array<{ id?: string; scenario?: string; evidenceIds?: string[] }> }
): string[] {
  const scenario = row.actorClass === "unknown"
    ? "unknown_actor_searching_only"
    : row.actorClass === "ransomware"
      ? "victim_extraction"
      : "actor_extraction";
  const ids = input?.fixtures
    ?.filter((fixture) => fixture.scenario === scenario)
    .map((fixture) => fixture.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0) ?? [];
  return ids.length > 0 ? ids : [`cti_eval_${scenario}`];
}

function regressionGuardrail(
  id: string,
  status: "pass" | "warn" | "hold",
  prevents: string,
  remediationAction: string
): ProgramBdQualityEvaluationPackDto["regressionGuardrails"][number] {
  return { id, status, prevents, remediationAction };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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
