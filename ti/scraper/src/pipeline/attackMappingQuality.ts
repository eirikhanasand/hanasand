import { mapAttackTechniqueCandidates } from "../export/attack.ts";
import type { AttackTechniqueCandidate, AttackTactic } from "../types.ts";
import { clampScore, stableId } from "../utils.ts";
import { actorAliasesFor } from "./actorAliases.ts";
import { buildActorQueryExtractionProfile, type EvidenceStage, type StagedEvidenceInput } from "./intelligenceProfiles.ts";

export type AttackMappingReviewState = "accepted" | "proposed" | "review_required" | "held";
export type AttackMappingStixImpact = "eligible" | "needs_review" | "blocked";

export interface AttackMappingCitationDto {
  evidenceId: string;
  sourceId: string;
  captureId: string;
  evidenceStage: EvidenceStage;
  collectedAt: string;
  extractorVersion?: string;
}

export interface AttackTechniqueQualityDto {
  id: string;
  attackId?: string;
  name: string;
  tactic: AttackTactic;
  confidence: number;
  reviewState: AttackMappingReviewState;
  actorRelevance: {
    score: number;
    matchedActorAliases: string[];
    reasons: string[];
  };
  campaignTimeframe: {
    firstSeenAt?: string;
    lastSeenAt?: string;
    reportPublishedAt?: string;
    campaignStart?: string;
    campaignEnd?: string;
    confidence: number;
    reasons: string[];
  };
  contradictionFlags: string[];
  drift: {
    deprecatedOrRevoked: boolean;
    replacementRequired: boolean;
    reasons: string[];
  };
  stixEligibility: {
    impact: AttackMappingStixImpact;
    reasons: string[];
  };
  evidenceIds: string[];
  sourceIds: string[];
  citations: AttackMappingCitationDto[];
}

export interface AttackMappingQualityDto {
  schemaVersion: "ti.attack_mapping_quality.v1";
  query: string;
  generatedAt: string;
  summary: {
    candidateCount: number;
    acceptedCount: number;
    reviewRequiredCount: number;
    heldCount: number;
    mappedAttackIdCount: number;
    stixEligibleCount: number;
  };
  techniques: AttackTechniqueQualityDto[];
  reviewQueues: {
    missingTechniqueId: string[];
    deprecatedOrRevoked: string[];
    weakActorRelevance: string[];
    missingTimeframe: string[];
    contradictions: string[];
    stixBlocked: string[];
  };
  releaseImpact: {
    publicAnswerState: "ready" | "partial" | "review_required";
    holdsReadyPromotion: boolean;
    caveats: string[];
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    preservesUncertainty: true;
  };
}

const DEPRECATED_OR_REVOKED_ATTACK_IDS = new Set(["T1066", "T1086", "T1111"]);

export function buildAttackMappingQualityDto(input: {
  query: string;
  evidence: StagedEvidenceInput[];
  generatedAt?: string;
}): AttackMappingQualityDto {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const techniques = input.evidence.flatMap((evidence) => techniquesForEvidence(input.query, evidence));
  const merged = mergeTechniques(techniques).slice(0, 80);
  const holdsReadyPromotion = merged.some((item) => item.reviewState === "held" || item.reviewState === "review_required");

  return {
    schemaVersion: "ti.attack_mapping_quality.v1",
    query: input.query,
    generatedAt,
    summary: {
      candidateCount: merged.length,
      acceptedCount: merged.filter((item) => item.reviewState === "accepted").length,
      reviewRequiredCount: merged.filter((item) => item.reviewState === "review_required").length,
      heldCount: merged.filter((item) => item.reviewState === "held").length,
      mappedAttackIdCount: merged.filter((item) => Boolean(item.attackId)).length,
      stixEligibleCount: merged.filter((item) => item.stixEligibility.impact === "eligible").length
    },
    techniques: merged,
    reviewQueues: {
      missingTechniqueId: queue(merged, (item) => !item.attackId),
      deprecatedOrRevoked: queue(merged, (item) => item.drift.deprecatedOrRevoked),
      weakActorRelevance: queue(merged, (item) => item.actorRelevance.score < 0.55),
      missingTimeframe: queue(merged, (item) => item.campaignTimeframe.confidence < 0.35),
      contradictions: queue(merged, (item) => item.contradictionFlags.length > 0),
      stixBlocked: queue(merged, (item) => item.stixEligibility.impact === "blocked")
    },
    releaseImpact: {
      publicAnswerState: merged.length === 0 || holdsReadyPromotion ? "review_required" : merged.some((item) => item.reviewState === "proposed") ? "partial" : "ready",
      holdsReadyPromotion,
      caveats: releaseCaveats(merged)
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      preservesUncertainty: true
    }
  };
}

function techniquesForEvidence(query: string, evidence: StagedEvidenceInput): AttackTechniqueQualityDto[] {
  const profile = buildActorQueryExtractionProfile(query, evidence.result);
  const candidates = mapAttackTechniqueCandidates(evidence.result);
  return candidates.map((candidate) => qualityForCandidate(query, evidence, candidate, profile));
}

function qualityForCandidate(
  query: string,
  evidence: StagedEvidenceInput,
  candidate: AttackTechniqueCandidate,
  profile: ReturnType<typeof buildActorQueryExtractionProfile>
): AttackTechniqueQualityDto {
  const citations = citationsFor(evidence, candidate);
  const actorRelevance = actorRelevanceFor(query, evidence);
  const campaignTimeframe = timeframeFor(profile);
  const contradictionFlags = contradictionFlagsFor(evidence, candidate);
  const drift = driftFor(evidence, candidate);
  const confidence = clampScore(candidate.confidence * 0.58 + actorRelevance.score * 0.24 + campaignTimeframe.confidence * 0.12 + (citations.length ? 0.06 : 0));
  const reviewState = reviewStateFor(candidate, confidence, actorRelevance.score, campaignTimeframe.confidence, contradictionFlags, drift);
  const stixEligibility = stixEligibilityFor(candidate, reviewState, drift, citations);

  return {
    id: stableId("attack-quality", `${candidate.attackId ?? candidate.name}:${evidence.id}`),
    attackId: candidate.attackId,
    name: candidate.name,
    tactic: candidate.tactic,
    confidence,
    reviewState,
    actorRelevance,
    campaignTimeframe,
    contradictionFlags,
    drift,
    stixEligibility,
    evidenceIds: [evidence.id],
    sourceIds: [evidence.result.capture.sourceId],
    citations
  };
}

function citationsFor(evidence: StagedEvidenceInput, candidate: AttackTechniqueCandidate): AttackMappingCitationDto[] {
  return candidate.provenance.slice(0, 8).map((item) => ({
    evidenceId: evidence.id,
    sourceId: item.sourceId,
    captureId: item.captureId,
    evidenceStage: evidence.stage,
    collectedAt: item.collectedAt,
    extractorVersion: item.extractorVersion
  }));
}

function actorRelevanceFor(query: string, evidence: StagedEvidenceInput): AttackTechniqueQualityDto["actorRelevance"] {
  const aliases = mergeStrings([query, ...actorAliasesFor(query)]).map((item) => item.toLowerCase());
  const actorEntities = evidence.result.entities
    .filter((entity) => entity.type === "actor")
    .flatMap((entity) => [entity.value, entity.normalizedValue, entity.rawValue, ...(entity.aliases ?? [])])
    .filter((value): value is string => Boolean(value));
  const matchedActorAliases = mergeStrings(actorEntities.filter((value) => aliases.includes(value.toLowerCase())));
  const hasDirectActor = matchedActorAliases.length > 0;
  const score = hasDirectActor ? 0.92 : actorEntities.length ? 0.55 : 0.28;
  return {
    score,
    matchedActorAliases,
    reasons: [
      hasDirectActor ? "technique evidence co-occurs with the queried actor or known alias" : "queried actor was not directly matched in technique evidence",
      ...(actorEntities.length > 1 ? ["multiple actor names require attribution review"] : [])
    ]
  };
}

function timeframeFor(profile: ReturnType<typeof buildActorQueryExtractionProfile>): AttackTechniqueQualityDto["campaignTimeframe"] {
  const temporal = profile.temporal;
  const hasDate = Boolean(temporal.firstSeenAt || temporal.lastSeenAt || temporal.reportPublishedAt || temporal.campaignWindow?.start || temporal.campaignWindow?.end);
  return {
    firstSeenAt: temporal.firstSeenAt,
    lastSeenAt: temporal.lastSeenAt,
    reportPublishedAt: temporal.reportPublishedAt,
    campaignStart: temporal.campaignWindow?.start,
    campaignEnd: temporal.campaignWindow?.end,
    confidence: hasDate ? clampScore(0.45 + temporal.freshnessScore * 0.5) : 0.18,
    reasons: hasDate ? ["dated evidence is available for campaign or report timeframe"] : ["no dated campaign or report timeframe extracted"]
  };
}

function contradictionFlagsFor(evidence: StagedEvidenceInput, candidate: AttackTechniqueCandidate): string[] {
  const text = `${captureTitle(evidence)} ${evidence.result.capture.body ?? ""}`;
  return [
    /\b(?:conflicting reports|vendor disagreement|disputed|contradict(?:ed|ory|ion))\b/i.test(text) ? "mapping appears in contradictory reporting" : undefined,
    /\b(?:not attributed to|not linked to|false positive|misattributed)\b/i.test(text) ? "negative attribution language near technique evidence" : undefined,
    candidate.reviewReasons.some((reason) => /review|confirm/i.test(reason)) ? "candidate mapper requires analyst confirmation" : undefined
  ].filter((item): item is string => Boolean(item));
}

function driftFor(evidence: StagedEvidenceInput, candidate: AttackTechniqueCandidate): AttackTechniqueQualityDto["drift"] {
  const text = `${candidate.attackId ?? ""} ${candidate.name} ${captureTitle(evidence)} ${evidence.result.capture.body ?? ""}`;
  const deprecatedOrRevoked = Boolean(candidate.attackId && DEPRECATED_OR_REVOKED_ATTACK_IDS.has(candidate.attackId)) || /\b(?:deprecated|revoked)\s+(?:ATT&CK|attack|technique|id)\b/i.test(text);
  return {
    deprecatedOrRevoked,
    replacementRequired: deprecatedOrRevoked,
    reasons: [
      ...(deprecatedOrRevoked ? ["ATT&CK mapping is marked deprecated/revoked or uses a held legacy technique id"] : []),
      ...candidate.reviewReasons
    ]
  };
}

function captureTitle(evidence: StagedEvidenceInput): string {
  const title = evidence.result.capture.metadata.title;
  return typeof title === "string" ? title : "";
}

function reviewStateFor(
  candidate: AttackTechniqueCandidate,
  confidence: number,
  actorRelevance: number,
  timeframeConfidence: number,
  contradictionFlags: string[],
  drift: AttackTechniqueQualityDto["drift"]
): AttackMappingReviewState {
  if (drift.deprecatedOrRevoked || contradictionFlags.length > 0) return "held";
  if (!candidate.attackId || actorRelevance < 0.55 || timeframeConfidence < 0.35) return "review_required";
  if (confidence >= 0.78) return "accepted";
  return "proposed";
}

function stixEligibilityFor(
  candidate: AttackTechniqueCandidate,
  reviewState: AttackMappingReviewState,
  drift: AttackTechniqueQualityDto["drift"],
  citations: AttackMappingCitationDto[]
): AttackTechniqueQualityDto["stixEligibility"] {
  const reasons = [
    ...(!candidate.attackId ? ["missing MITRE ATT&CK external id"] : []),
    ...(citations.length === 0 ? ["missing compact evidence citation"] : []),
    ...(drift.deprecatedOrRevoked ? ["deprecated/revoked ATT&CK ids cannot export as facts"] : []),
    ...(reviewState === "held" ? ["technique is held for analyst review"] : []),
    ...(reviewState === "review_required" ? ["technique requires analyst confirmation before STIX fact export"] : [])
  ];
  if (drift.deprecatedOrRevoked || reviewState === "held") return { impact: "blocked", reasons };
  if (!candidate.attackId || citations.length === 0 || reviewState === "review_required") return { impact: "needs_review", reasons };
  return { impact: "eligible", reasons: ["ATT&CK id, evidence citation, and review state allow STIX export"] };
}

function mergeTechniques(items: AttackTechniqueQualityDto[]): AttackTechniqueQualityDto[] {
  const byKey = new Map<string, AttackTechniqueQualityDto>();
  for (const item of items) {
    const key = item.attackId ?? item.name.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    existing.confidence = clampScore(Math.max(existing.confidence, item.confidence) + 0.04);
    existing.reviewState = strongerReviewState(existing.reviewState, item.reviewState);
    existing.actorRelevance.score = Math.max(existing.actorRelevance.score, item.actorRelevance.score);
    existing.actorRelevance.matchedActorAliases = mergeStrings([...existing.actorRelevance.matchedActorAliases, ...item.actorRelevance.matchedActorAliases]);
    existing.actorRelevance.reasons = mergeStrings([...existing.actorRelevance.reasons, ...item.actorRelevance.reasons]);
    existing.campaignTimeframe = mergeTimeframes(existing.campaignTimeframe, item.campaignTimeframe);
    existing.contradictionFlags = mergeStrings([...existing.contradictionFlags, ...item.contradictionFlags]);
    existing.drift = {
      deprecatedOrRevoked: existing.drift.deprecatedOrRevoked || item.drift.deprecatedOrRevoked,
      replacementRequired: existing.drift.replacementRequired || item.drift.replacementRequired,
      reasons: mergeStrings([...existing.drift.reasons, ...item.drift.reasons])
    };
    existing.evidenceIds = mergeStrings([...existing.evidenceIds, ...item.evidenceIds]).slice(0, 12);
    existing.sourceIds = mergeStrings([...existing.sourceIds, ...item.sourceIds]).slice(0, 12);
    existing.citations = mergeCitations([...existing.citations, ...item.citations]).slice(0, 12);
    existing.stixEligibility = stixEligibilityFor(
      { id: existing.id, attackId: existing.attackId, name: existing.name, tactic: existing.tactic, confidence: existing.confidence, provenance: [], reviewReasons: existing.drift.reasons },
      existing.reviewState,
      existing.drift,
      existing.citations
    );
  }
  return [...byKey.values()].sort((a, b) => reviewRank(a.reviewState) - reviewRank(b.reviewState) || b.confidence - a.confidence || a.name.localeCompare(b.name));
}

function mergeTimeframes(
  a: AttackTechniqueQualityDto["campaignTimeframe"],
  b: AttackTechniqueQualityDto["campaignTimeframe"]
): AttackTechniqueQualityDto["campaignTimeframe"] {
  return {
    firstSeenAt: earliest([a.firstSeenAt, b.firstSeenAt]),
    lastSeenAt: latest([a.lastSeenAt, b.lastSeenAt]),
    reportPublishedAt: latest([a.reportPublishedAt, b.reportPublishedAt]),
    campaignStart: earliest([a.campaignStart, b.campaignStart]),
    campaignEnd: latest([a.campaignEnd, b.campaignEnd]),
    confidence: Math.max(a.confidence, b.confidence),
    reasons: mergeStrings([...a.reasons, ...b.reasons])
  };
}

function releaseCaveats(items: AttackTechniqueQualityDto[]): string[] {
  return [
    ...(items.length === 0 ? ["no ATT&CK/TTP mapping candidates are available"] : []),
    ...items.flatMap((item) => [
      item.drift.deprecatedOrRevoked ? `${item.name} is held because the ATT&CK mapping may be deprecated or revoked` : undefined,
      item.contradictionFlags.length ? `${item.name} has contradiction flags` : undefined,
      item.stixEligibility.impact !== "eligible" ? `${item.name} is not STIX-fact eligible yet` : undefined
    ])
  ].filter((item): item is string => Boolean(item)).slice(0, 12);
}

function strongerReviewState(a: AttackMappingReviewState, b: AttackMappingReviewState): AttackMappingReviewState {
  return reviewRank(a) <= reviewRank(b) ? a : b;
}

function reviewRank(state: AttackMappingReviewState): number {
  return { held: 0, review_required: 1, proposed: 2, accepted: 3 }[state];
}

function queue(items: AttackTechniqueQualityDto[], predicate: (item: AttackTechniqueQualityDto) => boolean): string[] {
  return items.filter(predicate).map((item) => item.id);
}

function mergeCitations(items: AttackMappingCitationDto[]): AttackMappingCitationDto[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.evidenceId}:${item.sourceId}:${item.captureId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function earliest(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
}

function latest(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}
