import { stableId } from "../utils.ts";
import type { LiveActorIntelligenceDto, PublicIntelClaimDto } from "./actorProfileFusion.ts";
import type { EntityResolutionWorkbenchDto } from "./entityResolution.ts";
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
