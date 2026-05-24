import type { ExtractedEntity, Indicator } from "../types.ts";
import { clampScore } from "../utils.ts";
import { actorAliasesFor } from "./actorAliases.ts";
import {
  buildActorQueryExtractionProfile,
  buildLiveTiSearchSummary,
  buildTiSearchResultDto,
  type EvidenceStage,
  type GroundingReference,
  type StagedEvidenceInput,
  type TiConfidenceCaveat,
  type TiConfidenceCaveatCode
} from "./intelligenceProfiles.ts";
import { EXTRACTOR_VERSION } from "./extractors.ts";

export type ActorProfileDeltaKind =
  | "profile_changed"
  | "evidence_added"
  | "confidence_changed"
  | "needs_review"
  | "stale_field_removed"
  | "contradiction_detected"
  | "new_alias"
  | "changed_targeting_pattern"
  | "new_ttp"
  | "sudden_source_spike";

export interface ActorProfileSourceUncertainty {
  sourceId: string;
  evidenceId: string;
  evidenceStage: EvidenceStage;
  confidence: number;
  caveatCodes: TiConfidenceCaveatCode[];
  caveats: TiConfidenceCaveat[];
}

export interface ActorProfileSnapshot {
  actor: string;
  aliases: string[];
  vendorNames: string[];
  targets: {
    victims: string[];
    sectors: string[];
    regions: string[];
  };
  ttps: string[];
  confidence: number;
  updatedAt: string;
  evidenceIds: string[];
  sourceUncertainty: ActorProfileSourceUncertainty[];
  needsAnalystReview: boolean;
}

export interface ActorProfileDelta {
  kind: ActorProfileDeltaKind;
  message: string;
  field?: keyof ActorProfileSnapshot | "targets" | "targets.victims" | "targets.sectors" | "targets.regions";
  before?: string[] | number | boolean;
  after?: string[] | number | boolean;
  evidenceIds: string[];
  confidenceBefore?: number;
  confidenceAfter?: number;
  needsReview: boolean;
}

export interface ActorProfileDeltaSummary {
  profileChanged: boolean;
  evidenceAdded: boolean;
  confidenceChanged: boolean;
  needsReview: boolean;
  staleFieldRemoved: boolean;
  contradictionDetected: boolean;
  changes: ActorProfileDelta[];
}

export interface FuseActorProfileInput {
  query: string;
  baseline?: ActorProfileSnapshot;
  evidence: StagedEvidenceInput[];
  now?: string;
  staleAfterDays?: number;
  sourceSpikeThreshold?: number;
}

export interface FusedActorProfile {
  profile: ActorProfileSnapshot;
  deltas: ActorProfileDeltaSummary;
}

export type PublicProfileDeltaKind =
  | "new_evidence"
  | "changed_confidence"
  | "new_target_sector"
  | "new_target_country"
  | "added_ttp"
  | "stale_field_removed"
  | "contradiction"
  | "needs_review";

export interface PublicProfileDelta {
  kind: PublicProfileDeltaKind;
  label: string;
  values: string[];
  evidenceIds: string[];
  confidenceBefore?: number;
  confidenceAfter?: number;
  needsReview: boolean;
}

export type ActorProfileReadinessStatus = "fact" | "partial_evidence" | "needs_review";

export type ActorProfileReadinessField =
  | "summary"
  | "aliases"
  | "recent_activity"
  | "timeline_changes"
  | "targets"
  | "victims"
  | "sectors"
  | "regions"
  | "ttps"
  | "malware_tools"
  | "vulnerabilities"
  | "infrastructure"
  | "datasets";

export interface ActorProfileFieldReadiness {
  field: ActorProfileReadinessField;
  status: ActorProfileReadinessStatus;
  confidence: number;
  evidenceIds: string[];
  provenance: Array<{
    evidenceId: string;
    sourceId: string;
    evidenceStage: EvidenceStage;
    confidence: number;
  }>;
  caveatCodes: TiConfidenceCaveatCode[];
  reasons: string[];
}

export interface ActorProfileReadinessDto {
  overall: ActorProfileReadinessStatus;
  fields: Record<ActorProfileReadinessField, ActorProfileFieldReadiness>;
  downgradeReasons: string[];
  sourceFamilyCount: number;
  evidenceStageCounts: Record<EvidenceStage, number>;
}

export interface LiveActorIntelligenceDto {
  query: string;
  actor: string;
  summaryBullets: string[];
  aliases: string[];
  recentActivity: {
    firstSeen?: string;
    lastSeen?: string;
    reportPublishedAt?: string;
    freshnessScore: number;
    notes: string[];
  };
  targets: {
    victims: string[];
    sectors: string[];
    regions: string[];
  };
  campaigns: string[];
  ttps: string[];
  infrastructure: string[];
  malwareTools: string[];
  vulnerabilities: string[];
  datasets: {
    coverage: string[];
    sourceCount: number;
    indicatorCount: number;
    entityCount: number;
    evidenceStageCounts: Record<EvidenceStage, number>;
  };
  caveats: TiConfidenceCaveat[];
  confidence: number;
  provenance: Array<{
    evidenceId: string;
    ledgerIds: string[];
    sourceId: string;
    captureId?: string;
    url?: string;
    collectedAt?: string;
    evidenceStage: EvidenceStage;
    grounding: GroundingReference[];
    confidence: number;
  }>;
  profileDeltas: PublicProfileDelta[];
  falsePositiveControls: string[];
  readiness: ActorProfileReadinessDto;
  needsAnalystReview: boolean;
}

export type PublicIntelClaimKind =
  | "actor"
  | "victim"
  | "campaign"
  | "ttp"
  | "malware_tool"
  | "vulnerability"
  | "infrastructure"
  | "sector"
  | "region"
  | "timeline"
  | "dataset";

export interface PublicIntelClaimDto {
  kind: PublicIntelClaimKind;
  value: string;
  field: ActorProfileReadinessField;
  status: ActorProfileReadinessStatus;
  confidence: number;
  evidenceIds: string[];
  ledgerIds: string[];
  sourceFamilySupport: string[];
  extractionVersion: string;
  freshness: {
    score: number;
    firstSeen?: string;
    lastSeen?: string;
    reportPublishedAt?: string;
  };
  caveatCodes: string[];
  downgradeReasons: string[];
  analystReviewState: "not_required" | "recommended" | "required";
}

export type PublicIntelAnswerDeltaKind =
  | "new"
  | "promoted"
  | "downgraded"
  | "contradicted"
  | "expired"
  | "review_required";

export interface PublicIntelAnswerDeltaDto {
  kind: PublicIntelAnswerDeltaKind;
  claimKind: PublicIntelClaimKind;
  value: string;
  status: ActorProfileReadinessStatus;
  evidenceIds: string[];
  ledgerIds: string[];
  reasons: string[];
}

export interface PublicIntelReviewGateDto {
  claimKind: PublicIntelClaimKind;
  value: string;
  state: "passed" | "recommended" | "required";
  requiredForReady: boolean;
  requiredReviews: Array<"attribution" | "victim_claim" | "cve_exploitation" | "ttp_mapping" | "graph_hold" | "restricted_metadata" | "public_channel" | "source_diversity">;
  evidenceIds: string[];
  ledgerIds: string[];
  reasons: string[];
}

export type PublicIntelAnswerSlaStatus = "ready" | "partial" | "review_required" | "blocked";

export type PublicIntelAnswerExplanationCode =
  | "missing_captures"
  | "weak_evidence"
  | "source_bias"
  | "queue_pressure"
  | "parser_gap"
  | "public_channel_instability"
  | "restricted_only_evidence"
  | "graph_hold"
  | "review_required_claims";

export interface PublicIntelAnswerExplanationDto {
  code: PublicIntelAnswerExplanationCode;
  message: string;
  evidenceIds: string[];
  claimKinds: PublicIntelClaimKind[];
}

export interface PublicIntelAnswerReadinessSlaDto {
  status: PublicIntelAnswerSlaStatus;
  confidence: number;
  freshness: LiveActorIntelligenceDto["recentActivity"];
  evidenceFamilySupport: {
    sourceFamilyCount: number;
    ledgerIds: string[];
    evidenceIds: string[];
    evidenceStageCounts: Record<EvidenceStage, number>;
  };
  graphState: {
    status: "ready" | "hold" | "unknown";
    reasons: string[];
  };
  sourceSla: {
    status: "met" | "missed" | "unknown";
    reasons: string[];
  };
  schedulerState: {
    status: "normal" | "queue_pressure" | "unknown";
    reasons: string[];
  };
  publicChannelSla: {
    status: "stable" | "unstable" | "none";
    reasons: string[];
  };
  restrictedMetadataSla: {
    status: "compliant" | "restricted_only" | "blocked" | "none";
    reasons: string[];
  };
  explanations: PublicIntelAnswerExplanationDto[];
}

export type PublicIntelAnswerPromotionState =
  | "ready"
  | "partial"
  | "review_required"
  | "blocked"
  | "stale"
  | "contradicted"
  | "source_biased";

export type PublicIntelAnswerPromotionRuleCode =
  | "ready_support"
  | "source_sla"
  | "scheduler_sla"
  | "public_channel_sla"
  | "restricted_metadata_sla"
  | "graph_export_state"
  | "claim_ledger"
  | "freshness"
  | "contradiction"
  | "review_gate";

export interface PublicIntelAnswerPromotionRuleDto {
  code: PublicIntelAnswerPromotionRuleCode;
  state: "pass" | "warning" | "hold" | "block";
  message: string;
  reasons: string[];
  evidenceIds: string[];
  claimKinds: PublicIntelClaimKind[];
}

export type PublicIntelAnswerPromotionCaveatCode =
  | PublicIntelAnswerExplanationCode
  | "stale_answer"
  | "contradicted_answer";

export interface PublicIntelAnswerPromotionCaveatDto {
  code: PublicIntelAnswerPromotionCaveatCode;
  severity: "info" | "warning" | "critical";
  message: string;
  reasons: string[];
  evidenceIds: string[];
  claimKinds: PublicIntelClaimKind[];
}

export interface PublicIntelAnswerPromotionPolicyDto {
  state: PublicIntelAnswerPromotionState;
  canPromote: boolean;
  publicStatus: PublicIntelAnswerSlaStatus;
  rules: PublicIntelAnswerPromotionRuleDto[];
  caveats: PublicIntelAnswerPromotionCaveatDto[];
  pollableDeltas: Array<PublicIntelAnswerDeltaDto & {
    pollReason: "new_evidence" | "promotion_change" | "quality_hold" | "review_required" | "stale_or_contradicted";
    nextPollAfterSeconds: number;
  }>;
}

export type PublicIntelAnalystFusionQueryClass =
  | "actor"
  | "ransomware"
  | "cve"
  | "malware_tool"
  | "country"
  | "sector"
  | "unknown";

export interface PublicIntelAnalystFusionClaimDto {
  kind: PublicIntelClaimKind;
  value: string;
  status: ActorProfileReadinessStatus;
  confidence: number;
  ledgerIds: string[];
  evidenceIds: string[];
  provenance: Array<{
    evidenceId: string;
    sourceId: string;
    evidenceStage: EvidenceStage;
    collectedAt?: string;
  }>;
  graphExportState: PublicIntelAnswerReadinessSlaDto["graphState"]["status"];
  graphExportReasons: string[];
  caveats: string[];
}

export interface PublicIntelAnalystFusionDto {
  queryClass: PublicIntelAnalystFusionQueryClass;
  answerState: PublicIntelAnswerPromotionState;
  changed: Array<{
    field: "actor" | "aliases" | "victims" | "sectors" | "regions" | "ttps" | "malware_tools" | "vulnerabilities" | "infrastructure" | "confidence" | "evidence" | "timeline";
    values: string[];
    deltaKinds: PublicIntelAnswerDeltaKind[];
    evidenceIds: string[];
    ledgerIds: string[];
  }>;
  firstSeen?: string;
  lastSeen?: string;
  recentAttacks: Array<{
    victim?: string;
    campaign?: string;
    at?: string;
    sectors: string[];
    regions: string[];
    ttps: string[];
    malwareTools: string[];
    vulnerabilities: string[];
    confidence: number;
    evidenceIds: string[];
    ledgerIds: string[];
  }>;
  targetSectors: string[];
  targetRegions: string[];
  ttps: string[];
  datasets: string[];
  caveatDigest: Array<{
    code: PublicIntelAnswerPromotionCaveatCode | "missing_source_family";
    severity: "info" | "warning" | "critical";
    message: string;
    evidenceIds: string[];
    claimKinds: PublicIntelClaimKind[];
  }>;
  confidence: {
    score: number;
    state: PublicIntelAnswerPromotionState;
    sourceFamilyCount: number;
    ledgerBackedClaimCount: number;
  };
  contradictionHandling: {
    contradicted: boolean;
    holdReadyPromotion: boolean;
    reasons: string[];
    evidenceIds: string[];
  };
  sourceBias: {
    missingSourceFamily: boolean;
    sourceFamilyCount: number;
    reasons: string[];
  };
  staleEvidence: {
    stale: boolean;
    reasons: string[];
    evidenceIds: string[];
  };
  liveCollectionWaitingFor: Array<{
    code: "capture_promotion" | "source_family" | "graph_review" | "restricted_metadata_review" | "public_channel_corroboration" | "scheduler_capacity" | "parser_support" | "contradiction_resolution" | "fresh_evidence";
    message: string;
    evidenceIds: string[];
    claimKinds: PublicIntelClaimKind[];
  }>;
  claims: PublicIntelAnalystFusionClaimDto[];
  pollableDeltas: PublicIntelAnswerPromotionPolicyDto["pollableDeltas"];
}

export interface PublicTiAnswerContractDto {
  schemaVersion: "ti.public_answer_contract.v1";
  query: string;
  queryClass: PublicIntelAnalystFusionQueryClass;
  state: PublicIntelAnswerPromotionState;
  status: PublicIntelAnswerSlaStatus;
  displayState: "ready" | "partial" | "review_required" | "blocked";
  noResult: boolean;
  safeSummary: string[];
  confidence: {
    score: number;
    label: "high" | "medium" | "low" | "unknown";
    sourceFamilyCount: number;
    ledgerBackedClaimCount: number;
  };
  recentAttacks: PublicIntelAnalystFusionDto["recentAttacks"];
  targets: {
    victims: string[];
    sectors: string[];
    regions: string[];
  };
  ttps: string[];
  datasets: string[];
  sources: {
    sourceCount: number;
    evidenceStageCounts: Record<EvidenceStage, number>;
    evidenceIds: string[];
    ledgerIds: string[];
  };
  caveats: PublicIntelAnalystFusionDto["caveatDigest"];
  waitReasons: PublicIntelAnalystFusionDto["liveCollectionWaitingFor"];
  nextPoll: {
    pollable: boolean;
    nextPollAfterSeconds: number;
    cursorRequired: boolean;
    deltaCount: number;
  };
  evidenceLedgerReferences: Array<{
    claimKind: PublicIntelClaimKind;
    value: string;
    ledgerIds: string[];
    evidenceIds: string[];
    provenance: PublicIntelAnalystFusionClaimDto["provenance"];
  }>;
  graphStixReadiness: {
    state: PublicIntelAnswerReadinessSlaDto["graphState"]["status"];
    reasons: string[];
    readyForDefaultExport: boolean;
  };
  deltas: PublicIntelAnswerPromotionPolicyDto["pollableDeltas"];
  safeWording: {
    overstatesLiveSnippets: false;
    rawEvidenceExposed: false;
    restrictedPayloadsExposed: false;
    guidance: string[];
  };
}

export interface PublicIntelAnswerDto {
  query: string;
  actor: string;
  status: ActorProfileReadinessStatus;
  confidence: number;
  summary: string[];
  aliases: string[];
  recentActivity: LiveActorIntelligenceDto["recentActivity"];
  targets: LiveActorIntelligenceDto["targets"];
  campaigns: string[];
  victims: string[];
  ttps: string[];
  malwareTools: string[];
  vulnerabilities: string[];
  datasets: LiveActorIntelligenceDto["datasets"];
  timeline: Array<{
    label: string;
    at: string;
    readiness: ActorProfileReadinessStatus;
    evidenceIds: string[];
  }>;
  warnings: string[];
  warningCodes: string[];
  claims: PublicIntelClaimDto[];
  reviewGates: PublicIntelReviewGateDto[];
  deltas: PublicIntelAnswerDeltaDto[];
  readinessSla: PublicIntelAnswerReadinessSlaDto;
  promotionPolicy: PublicIntelAnswerPromotionPolicyDto;
  analystFusion: PublicIntelAnalystFusionDto;
  publicContract: PublicTiAnswerContractDto;
  provenanceNotes: string[];
  readiness: ActorProfileReadinessDto;
}

const FACT_SUPPRESSING_CAVEATS = new Set<TiConfidenceCaveatCode>([
  "historical_context",
  "live_snippet_only"
]);

export function fuseActorProfile(input: FuseActorProfileInput): FusedActorProfile {
  if (input.evidence.length === 0 && !input.baseline) {
    throw new Error("Cannot fuse an actor profile without baseline or evidence.");
  }

  const now = input.now ?? new Date().toISOString();
  const evidenceDtos = input.evidence.map((item) => ({
    evidence: item,
    dto: buildTiSearchResultDto(input.query, item.result)
  }));
  const summary = input.evidence.length > 0 ? buildLiveTiSearchSummary(input.query, input.evidence) : undefined;
  const actor = input.baseline?.actor ?? summary?.query ?? input.query;
  const staleBaseline = input.baseline ? isStale(input.baseline.updatedAt, now, input.staleAfterDays ?? 180) : false;
  const candidateAliases = mergeStrings([
    ...actorAliasesFor(actor),
    ...actorAliasesFor(input.query),
    ...evidenceDtos.flatMap(({ dto }) => dto.summaryBullets.flatMap(extractActorNames)),
    ...input.evidence.flatMap((item) => item.result.entities
      .filter((entity) => entity.type === "actor")
      .flatMap((entity) => [entity.value, ...(entity.aliases ?? [])]))
  ]);
  const acceptedDtos = evidenceDtos.filter(({ evidence, dto }) => canUseEvidenceForFacts(input.query, evidence, dto.caveats.map((caveat) => caveat.code), dto.datasets.coverage).accepted);
  const targets = {
    victims: mergeStrings([...(staleBaseline ? [] : input.baseline?.targets.victims ?? []), ...acceptedDtos.flatMap(({ dto }) => dto.targets.victims)]),
    sectors: mergeStrings([...(staleBaseline ? [] : input.baseline?.targets.sectors ?? []), ...acceptedDtos.flatMap(({ dto }) => dto.targets.sectors)]),
    regions: mergeStrings([...(staleBaseline ? [] : input.baseline?.targets.regions ?? []), ...acceptedDtos.flatMap(({ dto }) => dto.targets.regions)])
  };
  const ttps = mergeStrings([...(staleBaseline ? [] : input.baseline?.ttps ?? []), ...acceptedDtos.flatMap(({ dto }) => dto.ttps)]);
  const evidenceIds = mergeStrings([...(input.baseline?.evidenceIds ?? []), ...input.evidence.map((item) => item.id)]);
  const sourceUncertainty = [
    ...(input.baseline?.sourceUncertainty ?? []),
    ...evidenceDtos.map(({ evidence, dto }) => ({
      sourceId: evidence.result.capture.sourceId,
      evidenceId: evidence.id,
      evidenceStage: evidence.stage,
      confidence: dto.confidence,
      caveatCodes: dto.caveats.map((caveat) => caveat.code),
      caveats: dto.caveats
    }))
  ];
  const confidence = summary
    ? clampScore((input.baseline?.confidence ?? summary.confidence) * 0.45 + summary.confidence * 0.55)
    : input.baseline?.confidence ?? 0;
  const profile: ActorProfileSnapshot = {
    actor,
    aliases: mergeStrings([...(input.baseline?.aliases ?? []), ...candidateAliases]),
    vendorNames: mergeStrings([...(input.baseline?.vendorNames ?? []), ...candidateAliases.filter((alias) => alias !== actor.toLowerCase())]),
    targets,
    ttps,
    confidence,
    updatedAt: latest([input.baseline?.updatedAt, summary?.lastUpdated, now]) ?? now,
    evidenceIds,
    sourceUncertainty,
    needsAnalystReview: Boolean(summary?.needsAnalystReview || sourceUncertainty.some((source) => source.caveatCodes.includes("needs_review")))
  };

  const changes = profileDeltas(input, profile, acceptedDtos.map(({ evidence }) => evidence.id), sourceUncertainty);
  return {
    profile,
    deltas: {
      profileChanged: changes.some((change) => change.kind === "profile_changed"),
      evidenceAdded: changes.some((change) => change.kind === "evidence_added"),
      confidenceChanged: changes.some((change) => change.kind === "confidence_changed"),
      needsReview: changes.some((change) => change.needsReview),
      staleFieldRemoved: changes.some((change) => change.kind === "stale_field_removed"),
      contradictionDetected: changes.some((change) => change.kind === "contradiction_detected"),
      changes
    }
  };
}

export function buildLiveActorIntelligenceDto(input: FuseActorProfileInput): LiveActorIntelligenceDto {
  const fused = fuseActorProfile(input);
  const evidenceDtos = input.evidence.map((evidence) => ({
    evidence,
    dto: buildTiSearchResultDto(input.query, evidence.result),
    profile: buildActorQueryExtractionProfile(input.query, evidence.result)
  }));
  const accepted = evidenceDtos.filter(({ evidence, dto }) => canUseEvidenceForFacts(input.query, evidence, dto.caveats.map((caveat) => caveat.code), dto.datasets.coverage).accepted);
  const rejectedReasons = mergeStrings(evidenceDtos.flatMap(({ evidence, dto }) => canUseEvidenceForFacts(input.query, evidence, dto.caveats.map((caveat) => caveat.code), dto.datasets.coverage).reasons));
  const summary = input.evidence.length > 0 ? buildLiveTiSearchSummary(input.query, input.evidence) : undefined;
  const recentProfiles = accepted.length > 0 ? accepted : evidenceDtos;
  const recentDates = recentProfiles.map(({ profile }) => profile.temporal);
  const caveats = mergeCaveatObjects(evidenceDtos.flatMap(({ dto }) => dto.caveats));
  const infrastructure = mergeStrings(accepted.flatMap(({ evidence }) => evidence.result.indicators
    .filter((indicator) => indicator.type !== "cve")
    .map((indicator) => indicator.value)));
  const vulnerabilities = mergeStrings(accepted.flatMap(({ profile }) => profile.cves.map(entityOrIndicatorValue)));
  const malwareTools = mergeStrings(accepted.flatMap(({ profile }) => profile.malwareAndTooling.map((entity) => entity.value)));
  const allInfrastructure = mergeStrings(evidenceDtos.flatMap(({ evidence }) => evidence.result.indicators
    .filter((indicator) => indicator.type !== "cve")
    .map((indicator) => indicator.value)));
  const allVulnerabilities = mergeStrings(evidenceDtos.flatMap(({ evidence }) => [
    ...evidence.result.entities.filter((entity) => entity.type === "cve").map((entity) => entity.value),
    ...evidence.result.indicators.filter((indicator) => indicator.type === "cve").map((indicator) => indicator.value)
  ]));
  const allMalwareTools = mergeStrings(evidenceDtos.flatMap(({ profile }) => profile.malwareAndTooling.map((entity) => entity.value)));
  const restrictedMetadataFacts = restrictedMetadataFactBullets(evidenceDtos.map(({ evidence }) => evidence));
  const campaigns = mergeStrings(accepted.flatMap(({ evidence }) => explicitCampaignNames([
    evidence.result.capture.body ?? evidence.result.incident?.summary ?? ""
  ])));
  const summaryBullets = enrichSearchSummary(summary?.summaryBullets ?? [`No live evidence available for ${input.query}`], {
    malwareTools: allMalwareTools,
    vulnerabilities: allVulnerabilities,
    infrastructure: allInfrastructure,
    restrictedMetadataFacts
  });
  const provenance = evidenceDtos.map(({ evidence, dto }) => ({
    evidenceId: evidence.id,
    ledgerIds: evidenceLedgerIds(evidence),
    sourceId: evidence.result.capture.sourceId,
    captureId: evidence.result.capture.id,
    url: evidence.result.capture.url,
    collectedAt: evidence.result.capture.collectedAt,
    evidenceStage: evidence.stage,
    grounding: dto.caveats.flatMap((caveat) => caveat.grounding).slice(0, 8),
    confidence: dto.confidence
  }));
  const datasets = {
    coverage: mergeStrings([
      ...(summary?.datasets.coverage ?? []),
      ...(infrastructure.length ? ["infrastructure-observations"] : []),
      ...(malwareTools.length ? ["malware-tool-observations"] : []),
      ...(vulnerabilities.length ? ["vulnerability-observations"] : [])
    ]),
    sourceCount: new Set(input.evidence.map((item) => item.result.capture.sourceId)).size,
    indicatorCount: input.evidence.reduce((count, item) => count + item.result.indicators.length, 0),
    entityCount: input.evidence.reduce((count, item) => count + item.result.entities.length, 0),
    evidenceStageCounts: evidenceStageCounts(input.evidence)
  };
  const profileDeltas = publicProfileDeltas(input.baseline, fused);
  const readiness = buildActorProfileReadiness({
    dto: {
      targets: fused.profile.targets,
      ttps: fused.profile.ttps,
      infrastructure,
      malwareTools,
      vulnerabilities,
      datasets,
      confidence: fused.profile.confidence,
      caveats,
      provenance,
      profileDeltas,
      falsePositiveControls: rejectedReasons,
      recentActivity: {
        firstSeen: earliest(recentDates.map((temporal) => temporal.firstSeenAt)),
        lastSeen: latest(recentDates.map((temporal) => temporal.lastSeenAt)),
        reportPublishedAt: latest(recentDates.map((temporal) => temporal.reportPublishedAt)),
        freshnessScore: recentDates.length > 0 ? clampScore(recentDates.reduce((sum, temporal) => sum + temporal.freshnessScore, 0) / recentDates.length) : 0,
        notes: mergeStrings(recentDates.flatMap((temporal) => temporal.notes))
      },
      aliases: fused.profile.aliases,
      summaryBullets
    },
    evidenceDtos,
    acceptedEvidenceIds: accepted.map(({ evidence }) => evidence.id)
  });

  return {
    query: input.query,
    actor: fused.profile.actor,
    summaryBullets,
    aliases: fused.profile.aliases,
    recentActivity: {
      firstSeen: earliest(recentDates.map((temporal) => temporal.firstSeenAt)),
      lastSeen: latest(recentDates.map((temporal) => temporal.lastSeenAt)),
      reportPublishedAt: latest(recentDates.map((temporal) => temporal.reportPublishedAt)),
      freshnessScore: recentDates.length > 0 ? clampScore(recentDates.reduce((sum, temporal) => sum + temporal.freshnessScore, 0) / recentDates.length) : 0,
      notes: mergeStrings(recentDates.flatMap((temporal) => temporal.notes))
    },
    targets: fused.profile.targets,
    campaigns,
    ttps: fused.profile.ttps,
    infrastructure,
    malwareTools,
    vulnerabilities,
    datasets,
    caveats,
    confidence: fused.profile.confidence,
    provenance,
    profileDeltas,
    falsePositiveControls: rejectedReasons,
    readiness,
    needsAnalystReview: fused.profile.needsAnalystReview || readiness.overall === "needs_review" || caveats.some((caveat) => caveat.severity !== "info")
  };
}

function enrichSearchSummary(summary: string[], input: {
  malwareTools: string[];
  vulnerabilities: string[];
  infrastructure: string[];
  restrictedMetadataFacts: string[];
}): string[] {
  return mergeStrings([
    ...summary,
    ...input.restrictedMetadataFacts,
    ...(input.malwareTools.length ? [`Observed malware/tooling includes ${input.malwareTools.slice(0, 4).join(", ")}.`] : []),
    ...(input.vulnerabilities.length ? [`Referenced vulnerabilities include ${input.vulnerabilities.slice(0, 4).join(", ")}.`] : []),
    ...(input.infrastructure.length ? [`Infrastructure and indicator observations include ${input.infrastructure.slice(0, 4).join(", ")}.`] : [])
  ]).slice(0, 6);
}

function restrictedMetadataFactBullets(evidence: StagedEvidenceInput[]): string[] {
  return evidence.flatMap((item) => {
    const leakSite = objectRecord(item.result.capture.metadata.leakSite);
    if (!leakSite) return [];
    const actor = stringValue(leakSite.actorName);
    const victim = stringValue(leakSite.victimName);
    const affectedAccounts = stringValue(leakSite.affectedAccounts);
    const accountSubjects = stringValue(leakSite.accountSubjects);
    const datasetSize = stringValue(leakSite.datasetSize);
    const actorStatement = stringValue(leakSite.actorStatement);
    const claimedDate = stringValue(leakSite.claimDate);
    const dataCategory = stringValue(leakSite.claimedDataCategory) ?? stringValue(leakSite.claimedDataType);
    const sector = stringValue(leakSite.claimedSector);
    const country = stringValue(leakSite.claimedCountry);
    const postStatus = stringValue(leakSite.postStatus);
    const facts = [
      victim ? `company ${victim}` : undefined,
      actor ? `actor ${actor}` : undefined,
      affectedAccounts ? `${affectedAccounts} affected accounts` : undefined,
      accountSubjects ? `affected users ${accountSubjects}` : undefined,
      datasetSize ? `dataset size ${datasetSize}` : undefined,
      actorStatement ? `actor demand/statement: ${actorStatement}` : undefined,
      dataCategory ? `data category ${dataCategory}` : undefined,
      claimedDate ? `claimed date ${claimedDate}` : undefined,
      sector ? `sector ${sector}` : undefined,
      country ? `country ${country}` : undefined,
      postStatus ? `post status ${postStatus}` : undefined
    ].filter((value): value is string => Boolean(value));
    return facts.length ? [`Restricted metadata claim: ${facts.slice(0, 8).join("; ")}.`] : [];
  });
}

export function buildPublicIntelAnswerDto(
  dto: LiveActorIntelligenceDto,
  quality?: {
    status?: string;
    score?: number;
    publicWarningText?: string[];
    publicWarningCodes?: string[];
  }
): PublicIntelAnswerDto {
  const warningText = mergeStrings([
    ...(quality?.publicWarningText ?? []),
    ...dto.readiness.downgradeReasons,
    ...dto.falsePositiveControls,
    ...dto.recentActivity.notes
  ]).slice(0, 12);
  const warningCodes = mergeStrings([
    ...(quality?.publicWarningCodes ?? []),
    ...dto.caveats.map((caveat) => caveat.code),
    ...Object.values(dto.readiness.fields).flatMap((field) => field.status === "fact" ? [] : [`${field.field}:${field.status}`])
  ]).slice(0, 32);
  const claims = answerClaims(dto, warningText);
  const reviewGates = answerReviewGates(claims);
  const deltas = answerDeltas(claims);
  const readinessSla = answerReadinessSla(dto, claims, reviewGates, warningText, warningCodes, quality?.status);
  const promotionPolicy = answerPromotionPolicy(readinessSla, claims, reviewGates, deltas);
  const analystFusion = answerAnalystFusion(dto, claims, readinessSla, promotionPolicy, deltas);
  const publicContract = answerPublicContract(dto, claims, readinessSla, promotionPolicy, analystFusion);
  return {
    query: dto.query,
    actor: dto.actor,
    status: dto.readiness.overall,
    confidence: clampScore((quality?.score ?? dto.confidence) * 0.4 + dto.confidence * 0.6),
    summary: dto.summaryBullets.slice(0, 5),
    aliases: dto.aliases,
    recentActivity: dto.recentActivity,
    targets: dto.targets,
    campaigns: dto.campaigns,
    victims: dto.targets.victims,
    ttps: dto.ttps,
    malwareTools: dto.malwareTools,
    vulnerabilities: dto.vulnerabilities,
    datasets: dto.datasets,
    timeline: answerTimeline(dto),
    warnings: warningText,
    warningCodes,
    claims,
    reviewGates,
    deltas,
    readinessSla,
    promotionPolicy,
    analystFusion,
    publicContract,
    provenanceNotes: dto.provenance.map((item) =>
      `${item.evidenceStage} evidence ${item.evidenceId} from ${item.sourceId} (${Math.round(item.confidence * 100)}% confidence)`
    ).slice(0, 12),
    readiness: dto.readiness
  };
}

function answerPublicContract(
  dto: LiveActorIntelligenceDto,
  claims: PublicIntelClaimDto[],
  readinessSla: PublicIntelAnswerReadinessSlaDto,
  promotionPolicy: PublicIntelAnswerPromotionPolicyDto,
  analystFusion: PublicIntelAnalystFusionDto
): PublicTiAnswerContractDto {
  const ledgerIds = mergeStrings(claims.flatMap((claim) => claim.ledgerIds)).slice(0, 24);
  const evidenceIds = mergeStrings(claims.flatMap((claim) => claim.evidenceIds)).slice(0, 24);
  const nextPollAfterSeconds = promotionPolicy.pollableDeltas.length > 0
    ? Math.min(...promotionPolicy.pollableDeltas.map((delta) => delta.nextPollAfterSeconds))
    : promotionPolicy.canPromote
      ? 300
      : 15;
  return {
    schemaVersion: "ti.public_answer_contract.v1",
    query: dto.query,
    queryClass: analystFusion.queryClass,
    state: promotionPolicy.state,
    status: promotionPolicy.publicStatus,
    displayState: publicDisplayState(promotionPolicy),
    noResult: claims.length === 0 || (claims.length === 1 && claims[0]?.kind === "actor" && readinessSla.confidence === 0),
    safeSummary: publicSafeSummary(dto, promotionPolicy),
    confidence: {
      score: readinessSla.confidence,
      label: publicConfidenceLabel(readinessSla.confidence, promotionPolicy.state),
      sourceFamilyCount: readinessSla.evidenceFamilySupport.sourceFamilyCount,
      ledgerBackedClaimCount: analystFusion.confidence.ledgerBackedClaimCount
    },
    recentAttacks: analystFusion.recentAttacks,
    targets: {
      victims: dto.targets.victims,
      sectors: dto.targets.sectors,
      regions: dto.targets.regions
    },
    ttps: dto.ttps,
    datasets: dto.datasets.coverage,
    sources: {
      sourceCount: dto.datasets.sourceCount,
      evidenceStageCounts: dto.datasets.evidenceStageCounts,
      evidenceIds,
      ledgerIds
    },
    caveats: analystFusion.caveatDigest,
    waitReasons: analystFusion.liveCollectionWaitingFor,
    nextPoll: {
      pollable: !promotionPolicy.canPromote || promotionPolicy.pollableDeltas.length > 0,
      nextPollAfterSeconds,
      cursorRequired: true,
      deltaCount: promotionPolicy.pollableDeltas.length
    },
    evidenceLedgerReferences: analystFusion.claims.map((claim) => ({
      claimKind: claim.kind,
      value: claim.value,
      ledgerIds: claim.ledgerIds,
      evidenceIds: claim.evidenceIds,
      provenance: claim.provenance
    })),
    graphStixReadiness: {
      state: readinessSla.graphState.status,
      reasons: readinessSla.graphState.reasons,
      readyForDefaultExport: readinessSla.graphState.status === "ready" && promotionPolicy.canPromote
    },
    deltas: promotionPolicy.pollableDeltas,
    safeWording: {
      overstatesLiveSnippets: false,
      rawEvidenceExposed: false,
      restrictedPayloadsExposed: false,
      guidance: publicSafeWordingGuidance(promotionPolicy)
    }
  };
}

function publicDisplayState(policy: PublicIntelAnswerPromotionPolicyDto): PublicTiAnswerContractDto["displayState"] {
  if (policy.state === "blocked") return "blocked";
  if (policy.state === "review_required" || policy.state === "contradicted" || policy.state === "stale" || policy.state === "source_biased") return "review_required";
  if (policy.state === "ready") return "ready";
  return "partial";
}

function publicConfidenceLabel(score: number, state: PublicIntelAnswerPromotionState): PublicTiAnswerContractDto["confidence"]["label"] {
  if (state === "blocked" || score <= 0) return "unknown";
  if (score >= 0.82) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

function publicSafeSummary(dto: LiveActorIntelligenceDto, policy: PublicIntelAnswerPromotionPolicyDto): string[] {
  const prefix = policy.canPromote
    ? []
    : policy.state === "blocked"
      ? ["Blocked pending safety and provenance review."]
      : ["Partial; live and unreviewed claims stay caveated."];
  return mergeStrings([...prefix, ...dto.summaryBullets]).slice(0, 6);
}

function publicSafeWordingGuidance(policy: PublicIntelAnswerPromotionPolicyDto): string[] {
  return mergeStrings([
    policy.canPromote ? "Claims may be displayed as evidence-backed public intelligence." : "Use may/possibly/under review wording for all unpromoted claims.",
    policy.state === "contradicted" ? "Show contradiction caveats beside attribution and campaign claims." : "",
    policy.state === "stale" ? "Show stale-evidence caveats and wait for fresh corroboration." : "",
    policy.state === "source_biased" ? "Show missing-source-family caveats before any actor or victim claim." : "",
    policy.state === "blocked" ? "Do not render blocked restricted metadata as public facts." : ""
  ]);
}

function answerTimeline(dto: LiveActorIntelligenceDto): PublicIntelAnswerDto["timeline"] {
  const evidenceIds = dto.provenance.map((item) => item.evidenceId);
  return [
    dto.recentActivity.firstSeen ? { label: "First seen", at: dto.recentActivity.firstSeen, readiness: dto.readiness.fields.recent_activity.status, evidenceIds } : undefined,
    dto.recentActivity.lastSeen ? { label: "Last seen", at: dto.recentActivity.lastSeen, readiness: dto.readiness.fields.recent_activity.status, evidenceIds } : undefined,
    dto.recentActivity.reportPublishedAt ? { label: "Report published", at: dto.recentActivity.reportPublishedAt, readiness: dto.readiness.fields.recent_activity.status, evidenceIds } : undefined,
    ...dto.profileDeltas
      .filter((delta) => delta.kind === "new_evidence" || delta.kind === "changed_confidence" || delta.kind === "stale_field_removed" || delta.kind === "contradiction")
      .map((delta) => ({
        label: delta.label,
        at: dto.provenance.find((item) => delta.evidenceIds.includes(item.evidenceId))?.collectedAt ?? dto.recentActivity.reportPublishedAt ?? new Date(0).toISOString(),
        readiness: delta.needsReview ? "needs_review" as const : dto.readiness.overall,
        evidenceIds: delta.evidenceIds
      }))
  ].filter((item): item is PublicIntelAnswerDto["timeline"][number] => Boolean(item));
}

function answerClaims(dto: LiveActorIntelligenceDto, answerDowngrades: string[]): PublicIntelClaimDto[] {
  return [
    claimForValue("actor", dto.actor, "summary", dto, dto.provenance.map((item) => item.evidenceId), answerDowngrades),
    ...dto.campaigns.map((value) => claimForValue("campaign", value, "summary", dto, dto.provenance.map((item) => item.evidenceId), answerDowngrades)),
    ...dto.targets.victims.map((value) => claimForValue("victim", value, "victims", dto, dto.readiness.fields.victims.evidenceIds, answerDowngrades)),
    ...dto.targets.sectors.map((value) => claimForValue("sector", value, "sectors", dto, dto.readiness.fields.sectors.evidenceIds, answerDowngrades)),
    ...dto.targets.regions.map((value) => claimForValue("region", value, "regions", dto, dto.readiness.fields.regions.evidenceIds, answerDowngrades)),
    ...dto.ttps.map((value) => claimForValue("ttp", value, "ttps", dto, dto.readiness.fields.ttps.evidenceIds, answerDowngrades)),
    ...dto.malwareTools.map((value) => claimForValue("malware_tool", value, "malware_tools", dto, dto.readiness.fields.malware_tools.evidenceIds, answerDowngrades)),
    ...dto.vulnerabilities.map((value) => claimForValue("vulnerability", value, "vulnerabilities", dto, dto.readiness.fields.vulnerabilities.evidenceIds, answerDowngrades)),
    ...dto.infrastructure.map((value) => claimForValue("infrastructure", value, "infrastructure", dto, dto.readiness.fields.infrastructure.evidenceIds, answerDowngrades)),
    ...dto.datasets.coverage.map((value) => claimForValue("dataset", value, "datasets", dto, dto.readiness.fields.datasets.evidenceIds, answerDowngrades)),
    ...answerTimeline(dto).map((item) => claimForValue("timeline", `${item.label}: ${item.at}`, "timeline_changes", dto, item.evidenceIds, answerDowngrades))
  ];
}

function claimForValue(
  kind: PublicIntelClaimKind,
  value: string,
  field: ActorProfileReadinessField,
  dto: LiveActorIntelligenceDto,
  evidenceIds: string[],
  answerDowngrades: string[]
): PublicIntelClaimDto {
  const readiness = dto.readiness.fields[field];
  const evidence = dto.provenance.filter((item) => evidenceIds.includes(item.evidenceId));
  const sourceFamilySupport = mergeStrings(evidence.map((item) => item.sourceId));
  const ledgerIds = mergeStrings(evidence.flatMap((item) => item.ledgerIds.length ? item.ledgerIds : [item.evidenceId]));
  const supportDowngrades = claimSupportDowngrades(kind, readiness.status, evidence, sourceFamilySupport, ledgerIds);
  const downgradeReasons = mergeStrings([...readiness.reasons, ...dto.readiness.downgradeReasons, ...claimAnswerDowngrades(answerDowngrades), ...supportDowngrades]).slice(0, 14);
  const status = claimStatus(readiness.status, downgradeReasons);
  return {
    kind,
    value,
    field,
    status,
    confidence: readiness.confidence,
    evidenceIds: evidence.map((item) => item.evidenceId),
    ledgerIds,
    sourceFamilySupport,
    extractionVersion: EXTRACTOR_VERSION,
    freshness: {
      score: dto.recentActivity.freshnessScore,
      firstSeen: dto.recentActivity.firstSeen,
      lastSeen: dto.recentActivity.lastSeen,
      reportPublishedAt: dto.recentActivity.reportPublishedAt
    },
    caveatCodes: readiness.caveatCodes,
    downgradeReasons,
    analystReviewState: status === "needs_review" ? "required" : status === "partial_evidence" ? "recommended" : "not_required"
  };
}

function claimAnswerDowngrades(answerDowngrades: string[]): string[] {
  return answerDowngrades.filter((reason) => !/\bready for public answer\b/i.test(reason));
}

function claimSupportDowngrades(
  kind: PublicIntelClaimKind,
  readiness: ActorProfileReadinessStatus,
  evidence: LiveActorIntelligenceDto["provenance"],
  sourceFamilySupport: string[],
  ledgerIds: string[]
): string[] {
  const stages = evidence.map((item) => item.evidenceStage);
  const trustedStage = stages.some((stage) => stage === "reviewed_promoted" || stage === "extracted_relationship");
  const capturedStage = stages.some((stage) => stage === "captured_page");
  const publicOnly = stages.length > 0 && stages.every((stage) => stage === "public_channel_message");
  const restrictedOnly = stages.length > 0 && stages.every((stage) => stage === "metadata_only_claim");
  const snippetOnly = stages.length > 0 && stages.every((stage) => stage === "live_discovery" || stage === "seeded");
  const needsStrongSupport = kind === "actor" || kind === "victim" || kind === "vulnerability" || kind === "ttp";
  return [
    ...(readiness === "fact" && needsStrongSupport && sourceFamilySupport.length < 2 ? ["claim lacks two source-family supports"] : []),
    ...(readiness === "fact" && needsStrongSupport && ledgerIds.length < 2 ? ["claim lacks two ledger-backed supports"] : []),
    ...(readiness === "fact" && needsStrongSupport && !trustedStage && !capturedStage ? ["claim lacks captured or graph-reviewed support"] : []),
    ...(snippetOnly ? ["snippet-only claim remains partial until capture"] : []),
    ...(publicOnly ? ["public-channel-only claim requires corroboration"] : []),
    ...(restrictedOnly ? ["restricted-only claim requires analyst review"] : [])
  ];
}

function claimStatus(readiness: ActorProfileReadinessStatus, downgradeReasons: string[]): ActorProfileReadinessStatus {
  if (readiness === "needs_review") return "needs_review";
  if (downgradeReasons.some((reason) => /contradict|restricted-only|restricted metadata|graph export|requires analyst review|unsupported restricted/i.test(reason))) return "needs_review";
  if (readiness === "fact" && downgradeReasons.length > 0) return "partial_evidence";
  return readiness;
}

function answerReviewGates(claims: PublicIntelClaimDto[]): PublicIntelReviewGateDto[] {
  return claims
    .map((claim) => {
      const requiredReviews = claimReviewRequirements(claim);
      const requiredForReady = claim.status === "needs_review" || requiredReviews.some((review) =>
        review === "attribution" || review === "victim_claim" || review === "cve_exploitation" || review === "graph_hold" || review === "restricted_metadata"
      );
      const state: PublicIntelReviewGateDto["state"] = claim.status === "needs_review" || requiredForReady
        ? "required"
        : claim.status === "partial_evidence" || requiredReviews.length > 0
          ? "recommended"
          : "passed";
      return {
        claimKind: claim.kind,
        value: claim.value,
        state,
        requiredForReady,
        requiredReviews,
        evidenceIds: claim.evidenceIds,
        ledgerIds: claim.ledgerIds,
        reasons: mergeStrings([...claim.downgradeReasons, ...claim.caveatCodes]).slice(0, 10)
      };
    })
    .filter((gate) => gate.state !== "passed" || gate.requiredReviews.length > 0);
}

function claimReviewRequirements(claim: PublicIntelClaimDto): PublicIntelReviewGateDto["requiredReviews"] {
  const reasons = claim.downgradeReasons.join(" ");
  return mergeStrings([
    ...(claim.kind === "actor" && claim.status !== "fact" ? ["attribution"] : []),
    ...(claim.kind === "victim" && claim.status !== "fact" ? ["victim_claim"] : []),
    ...(claim.kind === "vulnerability" && claim.status !== "fact" ? ["cve_exploitation"] : []),
    ...(claim.kind === "ttp" && claim.status !== "fact" ? ["ttp_mapping"] : []),
    ...(/graph export|graph-held|graph hold/i.test(reasons) ? ["graph_hold"] : []),
    ...(/restricted|metadata-only/i.test(reasons) ? ["restricted_metadata"] : []),
    ...(/public-channel/i.test(reasons) ? ["public_channel"] : []),
    ...(/source-family|ledger-backed|source-biased|source family/i.test(reasons) ? ["source_diversity"] : [])
  ]) as PublicIntelReviewGateDto["requiredReviews"];
}

function answerDeltas(claims: PublicIntelClaimDto[]): PublicIntelAnswerDeltaDto[] {
  return claims.flatMap((claim) => {
    const reasons = mergeStrings(claim.downgradeReasons).slice(0, 8);
    const base = {
      claimKind: claim.kind,
      value: claim.value,
      status: claim.status,
      evidenceIds: claim.evidenceIds,
      ledgerIds: claim.ledgerIds
    };
    const deltas: PublicIntelAnswerDeltaDto[] = [{ ...base, kind: "new", reasons: ["claim observed in current answer evidence"] }];
    if (claim.status === "fact") deltas.push({ ...base, kind: "promoted", reasons: ["claim has ready support"] });
    if (claim.status === "partial_evidence") deltas.push({ ...base, kind: "downgraded", reasons });
    if (claim.status === "needs_review") deltas.push({ ...base, kind: "review_required", reasons });
    if (claim.caveatCodes.includes("contradicted") || reasons.some((reason) => /contradict/i.test(reason))) {
      deltas.push({ ...base, kind: "contradicted", reasons });
    }
    if (claim.caveatCodes.includes("stale") || reasons.some((reason) => /stale|expired/i.test(reason))) {
      deltas.push({ ...base, kind: "expired", reasons });
    }
    return deltas;
  }).slice(0, 48);
}

function answerReadinessSla(
  dto: LiveActorIntelligenceDto,
  claims: PublicIntelClaimDto[],
  reviewGates: PublicIntelReviewGateDto[],
  warnings: string[],
  warningCodes: string[],
  qualityStatus?: string
): PublicIntelAnswerReadinessSlaDto {
  const reasons = mergeStrings([
    ...warnings,
    ...warningCodes,
    ...dto.readiness.downgradeReasons,
    ...claims.flatMap((claim) => claim.downgradeReasons)
  ]);
  const ledgerIds = mergeStrings(claims.flatMap((claim) => claim.ledgerIds));
  const evidenceIds = mergeStrings(claims.flatMap((claim) => claim.evidenceIds));
  const status = answerSlaStatus(dto.readiness.overall, reasons, reviewGates, qualityStatus);
  const graphReasons = reasons.filter((reason) => /graph/i.test(reason));
  const sourceReasons = reasons.filter((reason) => /source SLO|source-family|source family|source-biased|ledger-backed/i.test(reason));
  const schedulerReasons = reasons.filter((reason) => /queue|scheduler|backpressure|delayed by rate|rate-limit/i.test(reason));
  const publicChannelReasons = reasons.filter((reason) => /public-channel/i.test(reason));
  const restrictedReasons = reasons.filter((reason) => /restricted|metadata-only/i.test(reason));
  return {
    status,
    confidence: clampScore(claims.length ? claims.reduce((sum, claim) => sum + claim.confidence, 0) / claims.length : dto.confidence),
    freshness: dto.recentActivity,
    evidenceFamilySupport: {
      sourceFamilyCount: dto.readiness.sourceFamilyCount,
      ledgerIds,
      evidenceIds,
      evidenceStageCounts: dto.readiness.evidenceStageCounts
    },
    graphState: {
      status: graphReasons.length ? "hold" : claims.some((claim) => claim.evidenceIds.length > 0) ? "ready" : "unknown",
      reasons: graphReasons.slice(0, 6)
    },
    sourceSla: {
      status: sourceReasons.some((reason) => /missed|bias|fewer|lacks/i.test(reason)) ? "missed" : dto.readiness.sourceFamilyCount > 0 ? "met" : "unknown",
      reasons: sourceReasons.slice(0, 6)
    },
    schedulerState: {
      status: schedulerReasons.length ? "queue_pressure" : "normal",
      reasons: schedulerReasons.slice(0, 6)
    },
    publicChannelSla: {
      status: publicChannelReasons.length ? "unstable" : dto.readiness.evidenceStageCounts.public_channel_message > 0 ? "stable" : "none",
      reasons: publicChannelReasons.slice(0, 6)
    },
    restrictedMetadataSla: {
      status: restrictedReasons.some((reason) => /block|non_compliant/i.test(reason)) ? "blocked" : dto.readiness.evidenceStageCounts.metadata_only_claim > 0 ? "restricted_only" : "none",
      reasons: restrictedReasons.slice(0, 6)
    },
    explanations: answerExplanations(claims, reviewGates, reasons, dto.readiness.evidenceStageCounts)
  };
}

function answerSlaStatus(
  readiness: ActorProfileReadinessStatus,
  reasons: string[],
  reviewGates: PublicIntelReviewGateDto[],
  qualityStatus?: string
): PublicIntelAnswerSlaStatus {
  if (reasons.some((reason) => /blocks promotion|policy_disabled|quarantined|blocked/i.test(reason))) return "blocked";
  if (readiness === "needs_review" || qualityStatus === "needs-review" || reviewGates.some((gate) => gate.requiredForReady)) return "review_required";
  if (readiness === "fact" && reviewGates.every((gate) => !gate.requiredForReady)) return "ready";
  return "partial";
}

function answerExplanations(
  claims: PublicIntelClaimDto[],
  reviewGates: PublicIntelReviewGateDto[],
  reasons: string[],
  stageCounts: Record<EvidenceStage, number>
): PublicIntelAnswerExplanationDto[] {
  return [
    explanation("missing_captures", "Answer is waiting on captured-page or graph-reviewed support.", /missing capture|snippet-only|insufficient-capture|lacks captured/i, claims, reasons, stageCounts.live_discovery > 0),
    explanation("weak_evidence", "Evidence is weak or not yet strong enough for a ready fact.", /weak|partial|unverified|low confidence/i, claims, reasons),
    explanation("source_bias", "Source-family or ledger support is not diverse enough.", /source-family|source family|source-biased|ledger-backed/i, claims, reasons),
    explanation("queue_pressure", "Scheduler or queue pressure is delaying stronger evidence.", /queue|scheduler|backpressure|rate-limit|delayed/i, claims, reasons),
    explanation("parser_gap", "Parser or adapter gaps prevent promotion.", /parser|adapter.*mismatch|parse/i, claims, reasons),
    explanation("public_channel_instability", "Public-channel evidence is unstable or needs corroboration.", /public-channel/i, claims, reasons, stageCounts.public_channel_message > 0),
    explanation("restricted_only_evidence", "Restricted metadata is not enough for a public ready fact.", /restricted|metadata-only/i, claims, reasons, stageCounts.metadata_only_claim > 0),
    explanation("graph_hold", "Graph review or export readiness is holding the claim.", /graph/i, claims, reasons),
    reviewRequiredExplanation(reviewGates)
  ].filter((item): item is PublicIntelAnswerExplanationDto => Boolean(item));
}

function explanation(
  code: PublicIntelAnswerExplanationCode,
  message: string,
  pattern: RegExp,
  claims: PublicIntelClaimDto[],
  reasons: string[],
  force = false
): PublicIntelAnswerExplanationDto | undefined {
  const matchedReasons = reasons.filter((reason) => pattern.test(reason));
  if (!force && matchedReasons.length === 0) return undefined;
  const matchedClaims = claims.filter((claim) => claim.downgradeReasons.some((reason) => pattern.test(reason)) || claim.caveatCodes.some((reason) => pattern.test(reason)));
  const scopedClaims = matchedClaims.length ? matchedClaims : claims.filter((claim) => claim.status !== "fact");
  return {
    code,
    message,
    evidenceIds: mergeStrings(scopedClaims.flatMap((claim) => claim.evidenceIds)).slice(0, 12),
    claimKinds: mergeStrings(scopedClaims.map((claim) => claim.kind)) as PublicIntelClaimKind[]
  };
}

function reviewRequiredExplanation(reviewGates: PublicIntelReviewGateDto[]): PublicIntelAnswerExplanationDto | undefined {
  const required = reviewGates.filter((gate) => gate.requiredForReady || gate.requiredReviews.some((review) => review === "victim_claim" || review === "cve_exploitation" || review === "ttp_mapping"));
  if (required.length === 0) return undefined;
  return {
    code: "review_required_claims",
    message: "One or more victim, CVE, TTP, or attribution claims need analyst review before ready promotion.",
    evidenceIds: mergeStrings(required.flatMap((gate) => gate.evidenceIds)).slice(0, 12),
    claimKinds: mergeStrings(required.map((gate) => gate.claimKind)) as PublicIntelClaimKind[]
  };
}

function answerPromotionPolicy(
  readinessSla: PublicIntelAnswerReadinessSlaDto,
  claims: PublicIntelClaimDto[],
  reviewGates: PublicIntelReviewGateDto[],
  deltas: PublicIntelAnswerDeltaDto[]
): PublicIntelAnswerPromotionPolicyDto {
  const rules = answerPromotionRules(readinessSla, claims, reviewGates, deltas);
  const caveats = answerPromotionCaveats(readinessSla, claims, deltas);
  const state = answerPromotionState(readinessSla, reviewGates, rules, deltas);
  return {
    state,
    canPromote: state === "ready",
    publicStatus: readinessSla.status,
    rules,
    caveats,
    pollableDeltas: deltas
      .filter((delta) => delta.kind !== "new" || delta.status !== "fact")
      .map((delta) => ({
        ...delta,
        pollReason: delta.kind === "promoted"
          ? "promotion_change" as const
          : delta.kind === "review_required"
            ? "review_required" as const
            : delta.kind === "contradicted" || delta.kind === "expired"
              ? "stale_or_contradicted" as const
              : delta.kind === "downgraded"
                ? "quality_hold" as const
                : "new_evidence" as const,
        nextPollAfterSeconds: delta.kind === "review_required" || delta.kind === "contradicted" ? 300 : delta.kind === "expired" ? 900 : 120
      }))
      .slice(0, 32)
  };
}

function answerPromotionState(
  readinessSla: PublicIntelAnswerReadinessSlaDto,
  reviewGates: PublicIntelReviewGateDto[],
  rules: PublicIntelAnswerPromotionRuleDto[],
  deltas: PublicIntelAnswerDeltaDto[]
): PublicIntelAnswerPromotionState {
  if (deltas.some((delta) => delta.kind === "contradicted")) return "contradicted";
  if (deltas.some((delta) => delta.kind === "expired")) return "stale";
  if (rules.some((rule) => rule.state === "block")) return "blocked";
  if (readinessSla.explanations.some((item) => item.code === "source_bias")) return "source_biased";
  if (reviewGates.some((gate) => gate.requiredForReady) || readinessSla.status === "review_required") return "review_required";
  if (readinessSla.status === "ready" && rules.every((rule) => rule.state === "pass" || rule.state === "warning")) return "ready";
  return "partial";
}

function answerPromotionRules(
  readinessSla: PublicIntelAnswerReadinessSlaDto,
  claims: PublicIntelClaimDto[],
  reviewGates: PublicIntelReviewGateDto[],
  deltas: PublicIntelAnswerDeltaDto[]
): PublicIntelAnswerPromotionRuleDto[] {
  const allEvidenceIds = mergeStrings(claims.flatMap((claim) => claim.evidenceIds));
  const allClaimKinds = mergeStrings(claims.map((claim) => claim.kind)) as PublicIntelClaimKind[];
  const ledgerReasons = mergeStrings(claims.flatMap((claim) => claim.downgradeReasons).filter((reason) => /ledger|trust ledger/i.test(reason)));
  const staleReasons = mergeStrings(claims.flatMap((claim) => [...claim.downgradeReasons, ...claim.caveatCodes]).filter((reason) => /stale|expired/i.test(reason)));
  const contradictionReasons = mergeStrings(claims.flatMap((claim) => [...claim.downgradeReasons, ...claim.caveatCodes]).filter((reason) => /contradict|disputed/i.test(reason)));
  return [
    promotionRule("ready_support", readinessSla.status === "ready" ? "pass" : "hold", "Answer must satisfy the public readiness SLA before promotion.", readinessSla.explanations.map((item) => item.message), allEvidenceIds, allClaimKinds),
    promotionRule("source_sla", readinessSla.sourceSla.status === "missed" ? "hold" : "pass", "Source SLA and diversity must be sufficient for public promotion.", readinessSla.sourceSla.reasons, allEvidenceIds, allClaimKinds),
    promotionRule("scheduler_sla", readinessSla.schedulerState.status === "queue_pressure" ? "warning" : "pass", "Scheduler pressure is disclosed but does not automatically block a partial answer.", readinessSla.schedulerState.reasons, allEvidenceIds, allClaimKinds),
    promotionRule("public_channel_sla", readinessSla.publicChannelSla.status === "unstable" ? "hold" : "pass", "Public-channel evidence must be stable or corroborated before ready promotion.", readinessSla.publicChannelSla.reasons, allEvidenceIds, allClaimKinds),
    promotionRule("restricted_metadata_sla", readinessSla.restrictedMetadataSla.status === "blocked" ? "block" : readinessSla.restrictedMetadataSla.status === "restricted_only" ? "hold" : "pass", "Restricted metadata cannot be the sole public promotion basis.", readinessSla.restrictedMetadataSla.reasons, allEvidenceIds, allClaimKinds),
    promotionRule("graph_export_state", readinessSla.graphState.status === "hold" ? "hold" : "pass", "Graph export state must not hold promoted facts.", readinessSla.graphState.reasons, allEvidenceIds, allClaimKinds),
    promotionRule("claim_ledger", ledgerReasons.length ? "hold" : readinessSla.evidenceFamilySupport.ledgerIds.length ? "pass" : "hold", "Claim ledger ids must be present and trusted for public promotion.", ledgerReasons, allEvidenceIds, allClaimKinds),
    promotionRule("freshness", staleReasons.length || deltas.some((delta) => delta.kind === "expired") ? "hold" : "pass", "Stale or expired evidence cannot promote as current public intelligence.", staleReasons, allEvidenceIds, allClaimKinds),
    promotionRule("contradiction", contradictionReasons.length || deltas.some((delta) => delta.kind === "contradicted") ? "block" : "pass", "Contradicted or disputed claims are blocked from public ready promotion.", contradictionReasons, allEvidenceIds, allClaimKinds),
    promotionRule("review_gate", reviewGates.some((gate) => gate.requiredForReady) ? "hold" : reviewGates.some((gate) => gate.state === "recommended") ? "warning" : "pass", "Required review gates must clear before ready promotion.", mergeStrings(reviewGates.flatMap((gate) => gate.reasons)), mergeStrings(reviewGates.flatMap((gate) => gate.evidenceIds)), mergeStrings(reviewGates.map((gate) => gate.claimKind)) as PublicIntelClaimKind[])
  ];
}

function promotionRule(
  code: PublicIntelAnswerPromotionRuleCode,
  state: PublicIntelAnswerPromotionRuleDto["state"],
  message: string,
  reasons: string[],
  evidenceIds: string[],
  claimKinds: PublicIntelClaimKind[]
): PublicIntelAnswerPromotionRuleDto {
  return {
    code,
    state,
    message,
    reasons: mergeStrings(reasons).slice(0, 8),
    evidenceIds: mergeStrings(evidenceIds).slice(0, 12),
    claimKinds: mergeStrings(claimKinds) as PublicIntelClaimKind[]
  };
}

function answerPromotionCaveats(
  readinessSla: PublicIntelAnswerReadinessSlaDto,
  claims: PublicIntelClaimDto[],
  deltas: PublicIntelAnswerDeltaDto[]
): PublicIntelAnswerPromotionCaveatDto[] {
  const caveats = readinessSla.explanations.map((item): PublicIntelAnswerPromotionCaveatDto => ({
    code: item.code,
    severity: item.code === "restricted_only_evidence" || item.code === "graph_hold" || item.code === "review_required_claims" ? "critical" : "warning",
    message: item.message,
    reasons: [],
    evidenceIds: item.evidenceIds,
    claimKinds: item.claimKinds
  }));
  const staleClaims = claims.filter((claim) => claim.caveatCodes.includes("stale") || claim.downgradeReasons.some((reason) => /stale|expired/i.test(reason)));
  if (staleClaims.length || deltas.some((delta) => delta.kind === "expired")) {
    caveats.push({
      code: "stale_answer",
      severity: "warning",
      message: "Answer includes stale or expired evidence and should remain partial until refreshed.",
      reasons: mergeStrings(staleClaims.flatMap((claim) => claim.downgradeReasons).filter((reason) => /stale|expired/i.test(reason))).slice(0, 8),
      evidenceIds: mergeStrings(staleClaims.flatMap((claim) => claim.evidenceIds)).slice(0, 12),
      claimKinds: mergeStrings(staleClaims.map((claim) => claim.kind)) as PublicIntelClaimKind[]
    });
  }
  const contradictedClaims = claims.filter((claim) => claim.caveatCodes.includes("contradicted") || claim.downgradeReasons.some((reason) => /contradict|disputed/i.test(reason)));
  if (contradictedClaims.length || deltas.some((delta) => delta.kind === "contradicted")) {
    caveats.push({
      code: "contradicted_answer",
      severity: "critical",
      message: "Answer includes contradicted or disputed claims and is blocked from ready promotion.",
      reasons: mergeStrings(contradictedClaims.flatMap((claim) => claim.downgradeReasons).filter((reason) => /contradict|disputed/i.test(reason))).slice(0, 8),
      evidenceIds: mergeStrings(contradictedClaims.flatMap((claim) => claim.evidenceIds)).slice(0, 12),
      claimKinds: mergeStrings(contradictedClaims.map((claim) => claim.kind)) as PublicIntelClaimKind[]
    });
  }
  return caveats.slice(0, 12);
}

function answerAnalystFusion(
  dto: LiveActorIntelligenceDto,
  claims: PublicIntelClaimDto[],
  readinessSla: PublicIntelAnswerReadinessSlaDto,
  promotionPolicy: PublicIntelAnswerPromotionPolicyDto,
  deltas: PublicIntelAnswerDeltaDto[]
): PublicIntelAnalystFusionDto {
  const queryClass = analystQueryClass(dto.query, claims, dto);
  const claimViews = claims.map((claim): PublicIntelAnalystFusionClaimDto => {
    const provenance = dto.provenance
      .filter((item) => claim.evidenceIds.includes(item.evidenceId))
      .map((item) => ({
        evidenceId: item.evidenceId,
        sourceId: item.sourceId,
        evidenceStage: item.evidenceStage,
        collectedAt: item.collectedAt
      }));
    return {
      kind: claim.kind,
      value: claim.value,
      status: claim.status,
      confidence: claim.confidence,
      ledgerIds: claim.ledgerIds,
      evidenceIds: claim.evidenceIds,
      provenance,
      graphExportState: readinessSla.graphState.status,
      graphExportReasons: readinessSla.graphState.reasons,
      caveats: mergeStrings([...claim.caveatCodes, ...claim.downgradeReasons]).slice(0, 10)
    };
  });
  const caveatDigest = analystCaveatDigest(readinessSla, promotionPolicy);
  const waits = analystLiveCollectionWaits(readinessSla, promotionPolicy);
  return {
    queryClass,
    answerState: promotionPolicy.state,
    changed: analystChanged(deltas),
    firstSeen: dto.recentActivity.firstSeen,
    lastSeen: dto.recentActivity.lastSeen,
    recentAttacks: analystRecentAttacks(dto, claims),
    targetSectors: dto.targets.sectors,
    targetRegions: dto.targets.regions,
    ttps: dto.ttps,
    datasets: dto.datasets.coverage,
    caveatDigest,
    confidence: {
      score: readinessSla.confidence,
      state: promotionPolicy.state,
      sourceFamilyCount: readinessSla.evidenceFamilySupport.sourceFamilyCount,
      ledgerBackedClaimCount: claims.filter((claim) => claim.ledgerIds.length > 0).length
    },
    contradictionHandling: {
      contradicted: promotionPolicy.state === "contradicted" || deltas.some((delta) => delta.kind === "contradicted"),
      holdReadyPromotion: promotionPolicy.rules.some((rule) => rule.code === "contradiction" && rule.state === "block"),
      reasons: mergeStrings([
        ...promotionPolicy.rules.filter((rule) => rule.code === "contradiction").flatMap((rule) => rule.reasons),
        ...promotionPolicy.caveats.filter((caveat) => caveat.code === "contradicted_answer").map((caveat) => caveat.message)
      ]),
      evidenceIds: mergeStrings(deltas.filter((delta) => delta.kind === "contradicted").flatMap((delta) => delta.evidenceIds))
    },
    sourceBias: {
      missingSourceFamily: readinessSla.evidenceFamilySupport.sourceFamilyCount < 2 || promotionPolicy.state === "source_biased",
      sourceFamilyCount: readinessSla.evidenceFamilySupport.sourceFamilyCount,
      reasons: mergeStrings([
        ...readinessSla.sourceSla.reasons,
        ...promotionPolicy.caveats.filter((caveat) => caveat.code === "source_bias").map((caveat) => caveat.message)
      ])
    },
    staleEvidence: {
      stale: promotionPolicy.state === "stale" || deltas.some((delta) => delta.kind === "expired"),
      reasons: mergeStrings([
        ...promotionPolicy.rules.filter((rule) => rule.code === "freshness").flatMap((rule) => rule.reasons),
        ...promotionPolicy.caveats.filter((caveat) => caveat.code === "stale_answer").map((caveat) => caveat.message)
      ]),
      evidenceIds: mergeStrings(deltas.filter((delta) => delta.kind === "expired").flatMap((delta) => delta.evidenceIds))
    },
    liveCollectionWaitingFor: promotionPolicy.canPromote ? [] : waits,
    claims: claimViews,
    pollableDeltas: promotionPolicy.pollableDeltas
  };
}

function analystQueryClass(
  query: string,
  claims: PublicIntelClaimDto[],
  dto: LiveActorIntelligenceDto
): PublicIntelAnalystFusionQueryClass {
  if (/\bCVE-\d{4}-\d{4,}\b/i.test(query) || claims.some((claim) => claim.kind === "vulnerability")) return "cve";
  if (dto.malwareTools.some((tool) => query.toLowerCase().includes(tool.toLowerCase())) || /\b(tool|malware|ransomware|stealer|rat)\b/i.test(query)) return "malware_tool";
  if (/\b(ransomware|akira|lockbit|clop|alphv|blackcat)\b/i.test(query)) return "ransomware";
  if (claims.some((claim) => claim.kind === "sector" && claim.value.toLowerCase() === query.toLowerCase())) return "sector";
  if (claims.some((claim) => claim.kind === "region" && claim.value.toLowerCase() === query.toLowerCase())) return "country";
  if (dto.confidence < 0.45 && claims.every((claim) => claim.status !== "fact")) return "unknown";
  return "actor";
}

function analystChanged(deltas: PublicIntelAnswerDeltaDto[]): PublicIntelAnalystFusionDto["changed"] {
  const fields: Array<PublicIntelAnalystFusionDto["changed"][number]["field"]> = [
    "actor",
    "aliases",
    "victims",
    "sectors",
    "regions",
    "ttps",
    "malware_tools",
    "vulnerabilities",
    "infrastructure",
    "confidence",
    "evidence",
    "timeline"
  ];
  return fields
    .map((field) => {
      const fieldDeltas = deltas.filter((delta) => analystDeltaField(delta.claimKind) === field);
      return {
        field,
        values: mergeStrings(fieldDeltas.map((delta) => delta.value)).slice(0, 10),
        deltaKinds: mergeStrings(fieldDeltas.map((delta) => delta.kind)) as PublicIntelAnswerDeltaKind[],
        evidenceIds: mergeStrings(fieldDeltas.flatMap((delta) => delta.evidenceIds)).slice(0, 12),
        ledgerIds: mergeStrings(fieldDeltas.flatMap((delta) => delta.ledgerIds)).slice(0, 12)
      };
    })
    .filter((item) => item.values.length > 0 || item.deltaKinds.length > 0);
}

function analystDeltaField(kind: PublicIntelClaimKind): PublicIntelAnalystFusionDto["changed"][number]["field"] {
  if (kind === "victim") return "victims";
  if (kind === "sector") return "sectors";
  if (kind === "region") return "regions";
  if (kind === "ttp") return "ttps";
  if (kind === "malware_tool") return "malware_tools";
  if (kind === "vulnerability") return "vulnerabilities";
  if (kind === "infrastructure") return "infrastructure";
  if (kind === "timeline") return "timeline";
  if (kind === "dataset") return "evidence";
  return "actor";
}

function analystRecentAttacks(dto: LiveActorIntelligenceDto, claims: PublicIntelClaimDto[]): PublicIntelAnalystFusionDto["recentAttacks"] {
  const attackEvidenceIds = mergeStrings(claims
    .filter((claim) => claim.kind === "victim" || claim.kind === "campaign" || claim.kind === "ttp" || claim.kind === "vulnerability" || claim.kind === "malware_tool")
    .flatMap((claim) => claim.evidenceIds));
  const attackLedgerIds = mergeStrings(claims
    .filter((claim) => attackEvidenceIds.some((id) => claim.evidenceIds.includes(id)))
    .flatMap((claim) => claim.ledgerIds));
  const victims = dto.targets.victims.length ? dto.targets.victims : [undefined];
  return victims.slice(0, 6).map((victim) => ({
    victim,
    campaign: dto.campaigns[0],
    at: dto.recentActivity.lastSeen ?? dto.recentActivity.firstSeen ?? dto.recentActivity.reportPublishedAt,
    sectors: dto.targets.sectors,
    regions: dto.targets.regions,
    ttps: dto.ttps,
    malwareTools: dto.malwareTools,
    vulnerabilities: dto.vulnerabilities,
    confidence: dto.confidence,
    evidenceIds: attackEvidenceIds,
    ledgerIds: attackLedgerIds
  })).filter((item) => item.victim || item.ttps.length || item.malwareTools.length || item.vulnerabilities.length);
}

function analystCaveatDigest(
  readinessSla: PublicIntelAnswerReadinessSlaDto,
  promotionPolicy: PublicIntelAnswerPromotionPolicyDto
): PublicIntelAnalystFusionDto["caveatDigest"] {
  const caveats: PublicIntelAnalystFusionDto["caveatDigest"] = promotionPolicy.caveats.map((caveat) => ({
    code: caveat.code,
    severity: caveat.severity,
    message: caveat.message,
    evidenceIds: caveat.evidenceIds,
    claimKinds: caveat.claimKinds
  }));
  if (readinessSla.evidenceFamilySupport.sourceFamilyCount < 2 && !caveats.some((caveat) => caveat.code === "missing_source_family")) {
    caveats.push({
      code: "missing_source_family" as const,
      severity: "warning" as const,
      message: "Answer is missing the minimum source-family diversity for analyst-grade promotion.",
      evidenceIds: readinessSla.evidenceFamilySupport.evidenceIds.slice(0, 12),
      claimKinds: [] as PublicIntelClaimKind[]
    });
  }
  return caveats.slice(0, 12);
}

function analystLiveCollectionWaits(
  readinessSla: PublicIntelAnswerReadinessSlaDto,
  promotionPolicy: PublicIntelAnswerPromotionPolicyDto
): PublicIntelAnalystFusionDto["liveCollectionWaitingFor"] {
  const waits = promotionPolicy.caveats.flatMap((caveat) => {
    const code = waitCodeForCaveat(caveat.code);
    return code ? [{ code, message: caveat.message, evidenceIds: caveat.evidenceIds, claimKinds: caveat.claimKinds }] : [];
  });
  if (readinessSla.evidenceFamilySupport.sourceFamilyCount < 2) {
    waits.push({
      code: "source_family",
      message: "Collect another approved source family before treating this as analyst-grade.",
      evidenceIds: readinessSla.evidenceFamilySupport.evidenceIds.slice(0, 12),
      claimKinds: []
    });
  }
  return mergeWaits(waits);
}

function waitCodeForCaveat(code: PublicIntelAnswerPromotionCaveatCode): PublicIntelAnalystFusionDto["liveCollectionWaitingFor"][number]["code"] | undefined {
  if (code === "missing_captures" || code === "weak_evidence") return "capture_promotion";
  if (code === "source_bias") return "source_family";
  if (code === "queue_pressure") return "scheduler_capacity";
  if (code === "parser_gap") return "parser_support";
  if (code === "public_channel_instability") return "public_channel_corroboration";
  if (code === "restricted_only_evidence" || code === "review_required_claims") return "restricted_metadata_review";
  if (code === "graph_hold") return "graph_review";
  if (code === "stale_answer") return "fresh_evidence";
  if (code === "contradicted_answer") return "contradiction_resolution";
  return undefined;
}

function mergeWaits(waits: PublicIntelAnalystFusionDto["liveCollectionWaitingFor"]): PublicIntelAnalystFusionDto["liveCollectionWaitingFor"] {
  const byCode = new Map<PublicIntelAnalystFusionDto["liveCollectionWaitingFor"][number]["code"], PublicIntelAnalystFusionDto["liveCollectionWaitingFor"][number]>();
  for (const wait of waits) {
    const existing = byCode.get(wait.code);
    byCode.set(wait.code, existing
      ? {
          ...existing,
          evidenceIds: mergeStrings([...existing.evidenceIds, ...wait.evidenceIds]).slice(0, 12),
          claimKinds: mergeStrings([...existing.claimKinds, ...wait.claimKinds]) as PublicIntelClaimKind[]
        }
      : wait);
  }
  return [...byCode.values()].slice(0, 10);
}

function explicitCampaignNames(summaryBullets: string[]): string[] {
  return mergeStrings(summaryBullets.flatMap((text) =>
    [...text.matchAll(/\bcampaign\s+(?:tracked\s+as\s+|named\s+|called\s+)?([A-Z][A-Za-z0-9][A-Za-z0-9 -]{1,60})/g)]
      .map((match) => cleanCampaignName(match[1] ?? ""))
      .filter((value) => value.length > 0)
  ));
}

function cleanCampaignName(value: string): string {
  const cleaned = value
    .split(/\s+(?:against|using|with|from|in|on|after|before)\b/i)[0]
    ?.replace(/[.,;:]+$/, "")
    .trim() ?? "";
  if (/^(campaign|activity|reporting|victim|target|targets|actor)$/i.test(cleaned)) return "";
  return cleaned;
}

function buildActorProfileReadiness(input: {
  dto: {
    summaryBullets: string[];
    aliases: string[];
    recentActivity: LiveActorIntelligenceDto["recentActivity"];
    targets: LiveActorIntelligenceDto["targets"];
    ttps: string[];
    infrastructure: string[];
    malwareTools: string[];
    vulnerabilities: string[];
    datasets: LiveActorIntelligenceDto["datasets"];
    caveats: TiConfidenceCaveat[];
    confidence: number;
    provenance: LiveActorIntelligenceDto["provenance"];
    profileDeltas: PublicProfileDelta[];
    falsePositiveControls: string[];
  };
  evidenceDtos: Array<{
    evidence: StagedEvidenceInput;
    dto: ReturnType<typeof buildTiSearchResultDto>;
  }>;
  acceptedEvidenceIds: string[];
}): ActorProfileReadinessDto {
  const evidenceStageCounts = input.dto.datasets.evidenceStageCounts;
  const sourceFamilyCount = new Set(input.evidenceDtos.map(({ evidence }) => evidence.result.capture.sourceId)).size;
  const downgradeReasons = mergeStrings([
    ...readinessDowngradeReasons(input.dto.caveats, input.dto.falsePositiveControls, sourceFamilyCount, evidenceStageCounts),
    ...operationalDowngradeReasons(input.evidenceDtos)
  ]);
  const caveatCodes = mergeStrings(input.dto.caveats.map((caveat) => caveat.code)) as TiConfidenceCaveatCode[];
  const acceptedIds = input.acceptedEvidenceIds.length ? input.acceptedEvidenceIds : input.dto.provenance.map((item) => item.evidenceId);
  const fields: Record<ActorProfileReadinessField, ActorProfileFieldReadiness> = {
    summary: fieldReadiness("summary", input.dto.summaryBullets, input, acceptedIds, [
      ...(input.dto.summaryBullets.length ? [] : ["no actor summary evidence"]),
      ...(sourceFamilyCount < 2 ? ["single source family summary"] : [])
    ]),
    aliases: fieldReadiness("aliases", input.dto.aliases, input, input.dto.provenance.map((item) => item.evidenceId), [
      ...(input.dto.aliases.length ? [] : ["no aliases resolved"]),
      ...(hasAliasCollisionDowngrade(input.dto.falsePositiveControls) ? ["alias collision requires review"] : [])
    ]),
    recent_activity: fieldReadiness("recent_activity", [
      input.dto.recentActivity.firstSeen,
      input.dto.recentActivity.lastSeen,
      input.dto.recentActivity.reportPublishedAt
    ].filter(Boolean) as string[], input, acceptedIds, input.dto.recentActivity.notes),
    timeline_changes: fieldReadiness("timeline_changes", input.dto.profileDeltas.filter((delta) => delta.kind === "stale_field_removed" || delta.kind === "contradiction").map((delta) => delta.label), input, input.dto.provenance.map((item) => item.evidenceId), [
      ...(input.dto.profileDeltas.some((delta) => delta.kind === "stale_field_removed") ? ["stale profile fields changed"] : []),
      ...(input.dto.profileDeltas.some((delta) => delta.kind === "contradiction") ? ["contradictory attribution changed timeline confidence"] : [])
    ]),
    targets: fieldReadiness("targets", [...input.dto.targets.victims, ...input.dto.targets.sectors, ...input.dto.targets.regions], input, acceptedIds, []),
    victims: fieldReadiness("victims", input.dto.targets.victims, input, acceptedIds, [
      ...(input.dto.targets.victims.length ? [] : ["no grounded victim claim"]),
      ...(hasCaveat(caveatCodes, "metadata_only_leak_claim") ? ["restricted metadata victim claim is unsupported without review"] : [])
    ]),
    sectors: fieldReadiness("sectors", input.dto.targets.sectors, input, acceptedIds, input.dto.targets.sectors.length ? [] : ["no grounded sector claim"]),
    regions: fieldReadiness("regions", input.dto.targets.regions, input, acceptedIds, input.dto.targets.regions.length ? [] : ["no grounded region claim"]),
    ttps: fieldReadiness("ttps", input.dto.ttps, input, acceptedIds, input.dto.ttps.length ? [] : ["no grounded TTP claim"]),
    malware_tools: fieldReadiness("malware_tools", input.dto.malwareTools, input, acceptedIds, input.dto.malwareTools.length ? [] : ["no malware or tool claim"]),
    vulnerabilities: fieldReadiness("vulnerabilities", input.dto.vulnerabilities, input, acceptedIds, input.dto.vulnerabilities.length ? [] : ["no vulnerability claim"]),
    infrastructure: fieldReadiness("infrastructure", input.dto.infrastructure, input, acceptedIds, input.dto.infrastructure.length ? [] : ["no infrastructure claim"]),
    datasets: fieldReadiness("datasets", input.dto.datasets.coverage, input, input.dto.provenance.map((item) => item.evidenceId), [
      ...(input.dto.datasets.coverage.length ? [] : ["no dataset coverage"]),
      ...(sourceFamilyCount < 2 ? ["source-family diversity is below readiness target"] : [])
    ])
  };
  return {
    overall: overallReadiness(Object.values(fields), downgradeReasons),
    fields,
    downgradeReasons,
    sourceFamilyCount,
    evidenceStageCounts
  };
}

function operationalDowngradeReasons(evidenceDtos: Array<{ evidence: StagedEvidenceInput }>): string[] {
  return mergeStrings(evidenceDtos.flatMap(({ evidence }) => {
    const metadata = evidence.result.capture.metadata;
    return [
      ...(metadata.evidenceTrustLedger === "degraded" || metadata.trustLedger === "degraded" ? ["evidence trust ledger downgraded this claim"] : []),
      ...(metadata.sourceSlo === "missed" || metadata.sourceSLO === "missed" ? ["source SLO missed freshness or reliability target"] : []),
      ...(metadata.publicChannelReliability === "low" ? ["public-channel reliability is low"] : []),
      ...(metadata.publicChannelReliabilityRating === "low" ? ["public-channel reliability is low"] : []),
      ...(metadata.publicChannelPartialEvidenceOnly === true ? ["public-channel evidence is partial-only"] : []),
      ...(metadata.publicChannelNeedsReview === true ? ["public-channel evidence requires review"] : []),
      ...(metadata.publicChannelHighDuplicateRatio === true ? ["public-channel duplicate ratio is high"] : []),
      ...(metadata.publicChannelHighEditDeleteChurn === true ? ["public-channel edit/delete churn is high"] : []),
      ...(["high_duplicate", "high_churn", "unavailable", "quarantined", "blocked", "policy_disabled"].includes(String(metadata.publicChannelRuntimeStatus ?? "")) ? [`public-channel runtime status is ${String(metadata.publicChannelRuntimeStatus)}`] : []),
      ...(metadata.publicChannelPromotionYield === "low" ? ["public-channel promotion yield is low"] : []),
      ...(metadata.restrictedMetadataCompliance === "blocked" || metadata.restrictedMetadataCompliance === "non_compliant" ? ["restricted metadata compliance blocks promotion"] : []),
      ...(metadata.graphExportReadiness === "blocked" || metadata.graphExportReady === false ? ["graph export readiness blocks fact promotion"] : [])
    ];
  }));
}

function evidenceLedgerIds(evidence: StagedEvidenceInput): string[] {
  const metadata = evidence.result.capture.metadata;
  return mergeStrings([
    ...stringArrayMetadata(metadata.evidenceLedgerIds),
    ...stringArrayMetadata(metadata.ledgerIds),
    ...stringArrayMetadata(metadata.trustLedgerIds),
    ...singleMetadata(metadata.evidenceLedgerId),
    ...singleMetadata(metadata.ledgerId),
    ...singleMetadata(metadata.trustLedgerId),
    evidence.id
  ]);
}

function stringArrayMetadata(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function singleMetadata(value: unknown): string[] {
  return typeof value === "string" && value.trim() ? [value] : [];
}

function fieldReadiness(
  field: ActorProfileReadinessField,
  values: string[],
  input: {
    dto: {
      caveats: TiConfidenceCaveat[];
      confidence: number;
      provenance: LiveActorIntelligenceDto["provenance"];
      falsePositiveControls: string[];
    };
  },
  evidenceIds: string[],
  localReasons: string[]
): ActorProfileFieldReadiness {
  const fieldEvidence = input.dto.provenance.filter((item) => evidenceIds.includes(item.evidenceId));
  const caveatCodes = mergeStrings(input.dto.caveats.map((caveat) => caveat.code)) as TiConfidenceCaveatCode[];
  const reasons = mergeStrings([...localReasons, ...fieldDowngradeReasons(field, caveatCodes, input.dto.falsePositiveControls)]);
  const status = readinessStatus(values, reasons, caveatCodes);
  const evidenceConfidence = fieldEvidence.length
    ? fieldEvidence.reduce((sum, item) => sum + item.confidence, 0) / fieldEvidence.length
    : input.dto.confidence;
  return {
    field,
    status,
    confidence: clampScore(evidenceConfidence * (status === "fact" ? 1 : status === "partial_evidence" ? 0.82 : 0.62)),
    evidenceIds: fieldEvidence.map((item) => item.evidenceId),
    provenance: fieldEvidence.map((item) => ({
      evidenceId: item.evidenceId,
      sourceId: item.sourceId,
      evidenceStage: item.evidenceStage,
      confidence: item.confidence
    })),
    caveatCodes,
    reasons
  };
}

function readinessStatus(values: string[], reasons: string[], caveatCodes: TiConfidenceCaveatCode[]): ActorProfileReadinessStatus {
  if (caveatCodes.includes("contradicted") || reasons.some((reason) => /requires review|unsupported|contradict/i.test(reason))) return "needs_review";
  if (values.length === 0) return "partial_evidence";
  if (caveatCodes.includes("metadata_only_leak_claim")) return "needs_review";
  if (caveatCodes.some((code) => code === "live_snippet_only" || code === "public_channel_mention" || code === "stale" || code === "historical_context")) {
    return "partial_evidence";
  }
  if (reasons.length > 0) return "partial_evidence";
  return "fact";
}

function overallReadiness(fields: ActorProfileFieldReadiness[], downgradeReasons: string[]): ActorProfileReadinessStatus {
  if (fields.some((field) => field.status === "needs_review") || downgradeReasons.some((reason) => /contradict|unsupported restricted|alias collision/i.test(reason))) {
    return "needs_review";
  }
  const coreFields: ActorProfileReadinessField[] = ["summary", "aliases", "recent_activity", "targets", "datasets"];
  if (fields.some((field) => coreFields.includes(field.field) && field.status === "partial_evidence") || downgradeReasons.length > 0) return "partial_evidence";
  return "fact";
}

function readinessDowngradeReasons(
  caveats: TiConfidenceCaveat[],
  falsePositiveControls: string[],
  sourceFamilyCount: number,
  stageCounts: Record<EvidenceStage, number>
): string[] {
  const codes = caveats.map((caveat) => caveat.code);
  return mergeStrings([
    ...(sourceFamilyCount < 2 ? ["source-family bias: fewer than two source families support the profile"] : []),
    ...(stageCounts.seeded > 0 ? ["seeded baseline is context, not runtime evidence"] : []),
    ...(stageCounts.live_discovery > 0 ? ["snippet-only evidence remains partial until captured"] : []),
    ...(stageCounts.public_channel_message > 0 ? ["public-channel evidence needs corroboration"] : []),
    ...(stageCounts.metadata_only_claim > 0 ? ["unsupported restricted metadata requires analyst review"] : []),
    ...(codes.includes("stale") ? ["stale evidence downgraded"] : []),
    ...(codes.includes("contradicted") ? ["contradictory attribution requires analyst review"] : []),
    ...(codes.includes("historical_context") ? ["historical context is not current actor activity"] : []),
    ...(hasAliasCollisionDowngrade(falsePositiveControls) ? ["alias collision or ransomware overlap requires analyst review"] : []),
    ...(falsePositiveControls.some((reason) => /weak victim/i.test(reason)) ? ["weak victim claim downgraded"] : []),
    ...falsePositiveControls.filter((reason) => /unrelated|marketing|broad list|partial/i.test(reason))
  ]);
}

function fieldDowngradeReasons(
  field: ActorProfileReadinessField,
  caveatCodes: TiConfidenceCaveatCode[],
  falsePositiveControls: string[]
): string[] {
  return [
    ...(field === "aliases" && hasAliasCollisionDowngrade(falsePositiveControls) ? ["alias collision requires review"] : []),
    ...(field === "victims" && caveatCodes.includes("metadata_only_leak_claim") ? ["restricted metadata victim claim is unsupported without review"] : []),
    ...(field === "recent_activity" && caveatCodes.includes("stale") ? ["recent activity downgraded by stale evidence"] : []),
    ...(field === "timeline_changes" && caveatCodes.includes("contradicted") ? ["contradictory attribution affects timeline changes"] : []),
    ...(field === "ttps" && caveatCodes.includes("historical_context") ? ["historical TTP context is not current activity"] : [])
  ];
}

function hasAliasCollisionDowngrade(falsePositiveControls: string[]): boolean {
  return falsePositiveControls.some((reason) => /alias collision|rebrand overlap/i.test(reason));
}

function hasCaveat(caveatCodes: TiConfidenceCaveatCode[], code: TiConfidenceCaveatCode): boolean {
  return caveatCodes.includes(code);
}

function profileDeltas(
  input: FuseActorProfileInput,
  profile: ActorProfileSnapshot,
  acceptedEvidenceIds: string[],
  sourceUncertainty: ActorProfileSourceUncertainty[]
): ActorProfileDelta[] {
  const baseline = input.baseline;
  const evidenceIds = input.evidence.map((item) => item.id);
  const changes: ActorProfileDelta[] = [];
  const newAliases = diff(profile.aliases, baseline?.aliases ?? []);
  const newVictims = diff(profile.targets.victims, baseline?.targets.victims ?? []);
  const newSectors = diff(profile.targets.sectors, baseline?.targets.sectors ?? []);
  const newRegions = diff(profile.targets.regions, baseline?.targets.regions ?? []);
  const newTtps = diff(profile.ttps, baseline?.ttps ?? []);
  const newEvidence = diff(profile.evidenceIds, baseline?.evidenceIds ?? []);
  const confidenceBefore = baseline?.confidence;
  const confidenceChanged = confidenceBefore !== undefined && Math.abs(profile.confidence - confidenceBefore) >= 0.15;
  const contradiction = sourceUncertainty.some((source) => source.caveatCodes.includes("contradicted"));
  const spikeThreshold = input.sourceSpikeThreshold ?? 4;
  const sourceSpike = new Set(input.evidence.map((item) => item.result.capture.sourceId)).size - new Set(baseline?.sourceUncertainty.map((source) => source.sourceId) ?? []).size >= spikeThreshold;

  if (newAliases.length > 0) {
    changes.push(delta("new_alias", "new actor alias or vendor naming variant observed", "aliases", baseline?.aliases ?? [], profile.aliases, evidenceIds, profile.needsAnalystReview));
  }
  if (newVictims.length > 0 || newSectors.length > 0 || newRegions.length > 0) {
    changes.push(delta("changed_targeting_pattern", "targeting pattern changed based on promoted evidence", "targets", baseline ? flattenTargets(baseline) : [], flattenTargets(profile), acceptedEvidenceIds, profile.needsAnalystReview));
  }
  if (newTtps.length > 0) {
    changes.push(delta("new_ttp", "new grounded TTP observed", "ttps", baseline?.ttps ?? [], profile.ttps, acceptedEvidenceIds, profile.needsAnalystReview));
  }
  if (newEvidence.length > 0) {
    changes.push(delta("evidence_added", "new evidence linked to actor profile", "evidenceIds", baseline?.evidenceIds ?? [], profile.evidenceIds, newEvidence, profile.needsAnalystReview));
  }
  if (confidenceChanged) {
    changes.push({
      kind: "confidence_changed",
      message: "profile confidence changed",
      field: "confidence",
      before: confidenceBefore,
      after: profile.confidence,
      evidenceIds,
      confidenceBefore,
      confidenceAfter: profile.confidence,
      needsReview: profile.needsAnalystReview
    });
  }
  if (contradiction) {
    changes.push(delta("contradiction_detected", "contradicted or disputed actor relationship detected", undefined, undefined, undefined, evidenceIds, true));
  }
  if (profile.needsAnalystReview) {
    changes.push(delta("needs_review", "actor profile fusion requires analyst review before promotion", "needsAnalystReview", baseline?.needsAnalystReview ?? false, true, evidenceIds, true));
  }
  if (sourceSpike) {
    changes.push(delta("sudden_source_spike", "sudden source spike observed for actor profile", "sourceUncertainty", baseline?.sourceUncertainty.length ?? 0, profile.sourceUncertainty.length, evidenceIds, true));
  }
  changes.push(...staleDeltas(input, profile));
  if (changes.some((change) => change.kind !== "profile_changed")) {
    changes.unshift(delta("profile_changed", "actor profile changed after evidence fusion", undefined, undefined, undefined, evidenceIds, profile.needsAnalystReview));
  }
  return changes;
}

function staleDeltas(input: FuseActorProfileInput, profile: ActorProfileSnapshot): ActorProfileDelta[] {
  const baseline = input.baseline;
  if (!baseline) return [];
  const staleAfterDays = input.staleAfterDays ?? 180;
  if (!isStale(baseline.updatedAt, input.now ?? profile.updatedAt, staleAfterDays)) return [];
  const deltas: ActorProfileDelta[] = [];
  if (baseline.ttps.length > 0 && diff(baseline.ttps, profile.ttps).length > 0) {
    deltas.push(delta("stale_field_removed", "stale TTP field removed because current evidence did not support it", "ttps", baseline.ttps, profile.ttps, profile.evidenceIds, true));
  }
  if (flattenTargets(baseline).length > 0 && diff(flattenTargets(baseline), flattenTargets(profile)).length > 0) {
    deltas.push(delta("stale_field_removed", "stale targeting field removed because current evidence did not support it", "targets", flattenTargets(baseline), flattenTargets(profile), profile.evidenceIds, true));
  }
  return deltas;
}

function canPromoteFacts(codes: TiConfidenceCaveatCode[], coverage: string[]): boolean {
  const hasGroundedFact = coverage.some((item) =>
    item === "victim-observations" ||
    item === "grounded-ttp-observations" ||
    item === "temporal-observations" ||
    item === "vulnerability-observations" ||
    item === "ioc-observations" ||
    item === "malware-tool-observations"
  );
  const onlySuppressing = codes.length > 0 && codes.every((code) => FACT_SUPPRESSING_CAVEATS.has(code) || code === "needs_review");
  return hasGroundedFact && !onlySuppressing;
}

function canUseEvidenceForFacts(
  query: string,
  evidence: StagedEvidenceInput,
  codes: TiConfidenceCaveatCode[],
  coverage: string[]
): { accepted: boolean; reasons: string[] } {
  const metadataTitle = typeof evidence.result.capture.metadata.title === "string" ? evidence.result.capture.metadata.title : "";
  const text = `${metadataTitle} ${evidence.result.capture.body ?? evidence.result.incident?.summary ?? ""}`;
  const reasons = [
    ...(!canPromoteFacts(codes, coverage) ? ["partial or historical evidence did not support profile facts"] : []),
    ...(/\b(?:cyber gang list|threat actor list|roundup|top\s+\d+)\b/i.test(text) ? ["broad list page suppressed as profile fact source"] : []),
    ...(/\b(?:webinar|whitepaper|download our report|book a demo|vendor marketing)\b/i.test(text) ? ["vendor marketing page suppressed as profile fact source"] : []),
    ...(isUnrelatedCveArticle(query, evidence.result.entities, evidence.result.indicators) ? ["unrelated CVE article suppressed because actor attribution was not grounded"] : []),
    ...(hasAliasCollision(query, evidence.result.entities) ? ["actor alias collision or ransomware rebrand overlap needs review"] : [])
  ];
  return { accepted: reasons.length === 0, reasons };
}

function publicProfileDeltas(baseline: ActorProfileSnapshot | undefined, fused: FusedActorProfile): PublicProfileDelta[] {
  const changes: PublicProfileDelta[] = [];
  const newEvidence = diff(fused.profile.evidenceIds, baseline?.evidenceIds ?? []);
  const newSectors = diff(fused.profile.targets.sectors, baseline?.targets.sectors ?? []);
  const newRegions = diff(fused.profile.targets.regions, baseline?.targets.regions ?? []);
  const newTtps = diff(fused.profile.ttps, baseline?.ttps ?? []);
  if (newEvidence.length > 0) {
    changes.push(publicDelta("new_evidence", "New evidence", newEvidence, newEvidence, fused.profile.needsAnalystReview));
  }
  if (baseline?.confidence !== undefined && Math.abs(fused.profile.confidence - baseline.confidence) >= 0.15) {
    changes.push({
      ...publicDelta("changed_confidence", "Confidence changed", [], fused.profile.evidenceIds, fused.profile.needsAnalystReview),
      confidenceBefore: baseline.confidence,
      confidenceAfter: fused.profile.confidence
    });
  }
  if (newSectors.length > 0) {
    changes.push(publicDelta("new_target_sector", "New target sector", newSectors, fused.profile.evidenceIds, fused.profile.needsAnalystReview));
  }
  if (newRegions.length > 0) {
    changes.push(publicDelta("new_target_country", "New target country", newRegions, fused.profile.evidenceIds, fused.profile.needsAnalystReview));
  }
  if (newTtps.length > 0) {
    changes.push(publicDelta("added_ttp", "Added TTP", newTtps, fused.profile.evidenceIds, fused.profile.needsAnalystReview));
  }
  for (const change of fused.deltas.changes) {
    if (change.kind === "stale_field_removed") {
      changes.push(publicDelta("stale_field_removed", "Stale field removed", stringifyDeltaValues(change.before), change.evidenceIds, true));
    }
    if (change.kind === "contradiction_detected") {
      changes.push(publicDelta("contradiction", "Contradiction detected", [], change.evidenceIds, true));
    }
    if (change.kind === "needs_review") {
      changes.push(publicDelta("needs_review", "Needs review", [], change.evidenceIds, true));
    }
  }
  return changes;
}

function publicDelta(kind: PublicProfileDeltaKind, label: string, values: string[], evidenceIds: string[], needsReview: boolean): PublicProfileDelta {
  return { kind, label, values, evidenceIds, needsReview };
}

function stringifyDeltaValues(value: ActorProfileDelta["before"]): string[] {
  if (Array.isArray(value)) return value;
  if (value === undefined) return [];
  return [String(value)];
}

function isUnrelatedCveArticle(query: string, entities: ExtractedEntity[], indicators: Indicator[]): boolean {
  const hasCve = indicators.some((indicator) => indicator.type === "cve") || entities.some((entity) => entity.type === "cve");
  if (!hasCve) return false;
  const actors = entities.filter((entity) => entity.type === "actor").map((entity) => entity.value.toLowerCase());
  return actors.length === 0 || !actors.some((actor) => actor.includes(query.toLowerCase()) || query.toLowerCase().includes(actor));
}

function hasAliasCollision(query: string, entities: ExtractedEntity[]): boolean {
  const actors = mergeStrings(entities.filter((entity) => entity.type === "actor").map((entity) => entity.value));
  if (actors.length <= 1) return false;
  return true;
}

function evidenceStageCounts(evidence: StagedEvidenceInput[]): Record<EvidenceStage, number> {
  return {
    seeded: evidence.filter((item) => item.stage === "seeded").length,
    live_discovery: evidence.filter((item) => item.stage === "live_discovery").length,
    captured_page: evidence.filter((item) => item.stage === "captured_page").length,
    public_channel_message: evidence.filter((item) => item.stage === "public_channel_message").length,
    metadata_only_claim: evidence.filter((item) => item.stage === "metadata_only_claim").length,
    extracted_relationship: evidence.filter((item) => item.stage === "extracted_relationship").length,
    reviewed_promoted: evidence.filter((item) => item.stage === "reviewed_promoted").length
  };
}

function entityOrIndicatorValue(item: ExtractedEntity | Indicator): string {
  return item.value;
}

function mergeCaveatObjects(caveats: TiConfidenceCaveat[]): TiConfidenceCaveat[] {
  const byCode = new Map<TiConfidenceCaveatCode, TiConfidenceCaveat>();
  for (const caveat of caveats) {
    const existing = byCode.get(caveat.code);
    byCode.set(caveat.code, existing ? { ...existing, grounding: [...existing.grounding, ...caveat.grounding].slice(0, 12) } : caveat);
  }
  return [...byCode.values()];
}

function delta(
  kind: ActorProfileDeltaKind,
  message: string,
  field: ActorProfileDelta["field"],
  before: ActorProfileDelta["before"],
  after: ActorProfileDelta["after"],
  evidenceIds: string[],
  needsReview: boolean
): ActorProfileDelta {
  return { kind, message, field, before, after, evidenceIds, needsReview };
}

function flattenTargets(profile: Pick<ActorProfileSnapshot, "targets">): string[] {
  return mergeStrings([...profile.targets.victims, ...profile.targets.sectors, ...profile.targets.regions]);
}

function extractActorNames(text: string): string[] {
  const candidates = [...text.matchAll(/\b(?:APT\d{2}|[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\b/g)].map((match) => match[0]);
  return candidates.filter((candidate) => !/^(Direct|Recent|Targets|Uses|No|Evidence|Actor|Published|First|Last)$/i.test(candidate));
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mergeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }
  return merged;
}

function diff(after: string[], before: string[]): string[] {
  const beforeSet = new Set(before.map((item) => item.toLowerCase()));
  return after.filter((item) => !beforeSet.has(item.toLowerCase()));
}

function latest(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => {
      if (typeof value !== "string" || !value) return false;
      return !Number.isNaN(Date.parse(value));
    })
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function earliest(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => {
      if (typeof value !== "string" || !value) return false;
      return !Number.isNaN(Date.parse(value));
    })
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
}

function isStale(updatedAt: string, now: string, staleAfterDays: number): boolean {
  const updated = Date.parse(updatedAt);
  const current = Date.parse(now);
  if (Number.isNaN(updated) || Number.isNaN(current)) return false;
  return (current - updated) / 86_400_000 >= staleAfterDays;
}
