import type { LiveActorIntelligenceDto } from "./actorProfileFusion.ts";
import type { ExtractionCalibrationReport, ExtractionQualityNoteCode } from "./evaluation.ts";
import type { EvidenceStage, TiConfidenceCaveat, TiConfidenceCaveatCode } from "./intelligenceProfiles.ts";

export type SearchQualityStatus =
  | "ready"
  | "partial"
  | "weak-evidence"
  | "needs-review"
  | "contradicted"
  | "stale"
  | "source-biased"
  | "insufficient-capture";

export type GraphReviewState =
  | "accepted"
  | "proposed"
  | "needs-human-review"
  | "contradiction"
  | "stale"
  | "rejected"
  | "downgraded"
  | "superseded";

export interface AnalystCaveatPack {
  actor: string;
  summary: string;
  caveats: string[];
  reviewFocus: string[];
}

export interface SearchQualityGateInput {
  dto: LiveActorIntelligenceDto;
  calibration?: ExtractionCalibrationReport;
  graphReviewState?: GraphReviewState;
}

export interface SearchQualityGateResult {
  status: SearchQualityStatus;
  supportingStatuses: SearchQualityStatus[];
  score: number;
  reasons: string[];
  caveatCodes: TiConfidenceCaveatCode[];
  qualityNoteCodes: ExtractionQualityNoteCode[];
  caveatPack: AnalystCaveatPack;
  apiWarnings: Array<{
    code: SearchQualityStatus | ExtractionQualityNoteCode | TiConfidenceCaveatCode;
    message: string;
    severity: "info" | "warning" | "critical";
  }>;
}

export type SearchQualityApplyActionKind =
  | "analyst_review"
  | "lower_confidence"
  | "request_more_capture_evidence"
  | "suppress_noisy_alias"
  | "mark_contradiction"
  | "expire_stale_claim"
  | "promote_quality_status";

export interface SearchQualityApplyActionDto {
  kind: SearchQualityApplyActionKind;
  label: string;
  prerequisites: string[];
  evidenceIds: string[];
  expectedApiEffect: string;
  graphEffect: string;
  rollback: string;
  manualOnly: boolean;
}

export interface SearchQualityApplyPlanDto {
  query: string;
  currentStatus: SearchQualityStatus;
  targetStatus: SearchQualityStatus;
  canPromoteToReady: boolean;
  actions: SearchQualityApplyActionDto[];
}

export type SearchQualityPublicWarningCode =
  | SearchQualityStatus
  | ExtractionQualityNoteCode
  | TiConfidenceCaveatCode
  | "alias_collision_warning";

export interface SearchQualityAnalystActionSummaryDto {
  kind: SearchQualityApplyActionKind;
  label: string;
  manualOnly: boolean;
  evidenceIds: string[];
}

export interface SearchQualityApiDto {
  status: SearchQualityStatus;
  score: number;
  caveatCodes: TiConfidenceCaveatCode[];
  qualityNoteCodes: ExtractionQualityNoteCode[];
  evidenceStageCounts: Record<EvidenceStage, number>;
  analystActions: SearchQualityAnalystActionSummaryDto[];
  canPromoteToReady: boolean;
  publicWarningText: string[];
  publicWarningCodes: SearchQualityPublicWarningCode[];
}

export type SearchQualityDashboardField =
  | "actor_summary"
  | "aliases"
  | "recent_activity"
  | "targets"
  | "sectors"
  | "countries"
  | "tools_malware"
  | "cves"
  | "ttps"
  | "campaigns"
  | "infrastructure"
  | "datasets"
  | "victim_company_claims"
  | "iocs"
  | "confidence"
  | "freshness"
  | "provenance";

export type SearchQualityDashboardGate = "pass" | "warn" | "hold" | "missing";

export interface SearchQualityFieldGateDto {
  field: SearchQualityDashboardField;
  gate: SearchQualityDashboardGate;
  confidence: number;
  evidenceCount: number;
  citationCount: number;
  freshnessScore: number;
  reasons: string[];
  feedbackTargets: Array<"source_activation" | "parser_repair" | "graph_review" | "analyst_review" | "public_answer_hold">;
}

export interface SearchQualityDashboardDto {
  schemaVersion: "ti.search_quality_dashboard.v1";
  query: string;
  generatedAt: string;
  status: SearchQualityStatus;
  score: number;
  metrics: {
    usefulAnswerRate: number;
    expectedFactRecall: number;
    staleFactSuppression: "pass" | "hold";
    contradictionHandling: "pass" | "hold";
    sourceFamilyDiversity: number;
    evidenceCount: number;
    citationAvailability: number;
    freshnessScore: number;
  };
  releaseGate: {
    decision: "promote" | "partial" | "hold";
    reasons: string[];
  };
  fields: SearchQualityFieldGateDto[];
  reviewQueues: {
    sourceActivation: string[];
    parserRepair: string[];
    graphReview: string[];
    analystReview: string[];
  };
}

export interface SearchQualityApiExampleDto {
  name: string;
  query: string;
  quality: SearchQualityApiDto;
  dashboard: SearchQualityDashboardDto;
}

const QUALITY_STATUS_RANK: SearchQualityStatus[] = [
  "contradicted",
  "stale",
  "source-biased",
  "partial",
  "insufficient-capture",
  "weak-evidence",
  "needs-review",
  "ready"
];

const CAVEAT_PACKS: Record<string, AnalystCaveatPack> = {
  apt29: {
    actor: "APT29",
    summary: "APT29 reporting is alias-heavy and often blends historical tradecraft with current intrusion reporting.",
    caveats: ["Confirm whether aliases such as Midnight Blizzard, Nobelium, Cozy Bear, and The Dukes refer to the same activity window.", "Separate current victim/sector claims from historical tradecraft summaries."],
    reviewFocus: ["current campaign dates", "victim attribution", "TTP freshness"]
  },
  "scattered spider": {
    actor: "Scattered Spider",
    summary: "Scattered Spider reporting is prone to social-engineering cluster naming drift and co-mentions with adjacent cybercrime brands.",
    caveats: ["Treat Scattered Spider, Octo Tempest, UNC3944, 0ktapus, and ShinyHunters overlap as vendor naming until corroborated.", "Do not promote broad cybercrime roundups into actor facts."],
    reviewFocus: ["alias collision", "social engineering TTPs", "victim confidence"]
  },
  "volt typhoon": {
    actor: "Volt Typhoon",
    summary: "Volt Typhoon reporting can include high-impact infrastructure claims where source family and freshness matter.",
    caveats: ["Check whether living-off-the-land claims are current, sourced, and tied to specific victims or sectors.", "Public-channel claims should remain partial until captured or corroborated."],
    reviewFocus: ["source family bias", "critical infrastructure targeting", "contradictions"]
  },
  turla: {
    actor: "Turla",
    summary: "Turla profiles often include long-lived tooling and stale background material.",
    caveats: ["Do not treat older Snake or Waterbug references as current without a fresh report date.", "Review stale source warnings before ranking as ready."],
    reviewFocus: ["staleness", "malware/tool freshness", "current victim claims"]
  },
  akira: {
    actor: "Akira",
    summary: "Akira evidence often arrives as restricted or metadata-only victim claims.",
    caveats: ["Metadata-only victim claims should be analyst-reviewed before public promotion.", "Keep ransomware list/rebrand co-mentions out of profile facts unless supported."],
    reviewFocus: ["victim claim strength", "restricted metadata", "rebrand overlap"]
  },
  muddywater: {
    actor: "MuddyWater",
    summary: "MuddyWater reporting often mixes vendor aliases with campaign and malware names.",
    caveats: ["Preserve Seedworm, Static Kitten, TEMP.Zagros, and Mercury naming as aliases until evidence confirms the same activity.", "Review government-sector targeting claims for freshness and source diversity."],
    reviewFocus: ["alias mapping", "government targeting", "malware/tool freshness"]
  },
  shinyhunters: {
    actor: "ShinyHunters",
    summary: "ShinyHunters reporting frequently appears in naming-drift contexts with Scattered Spider and other cybercrime clusters.",
    caveats: ["Preserve vendor naming differences and avoid collapsing aliases without source support.", "Require corroboration before promoting overlap as a stable actor relationship."],
    reviewFocus: ["alias collision", "vendor naming", "relationship confidence"]
  },
  unknown: {
    actor: "Unknown actor",
    summary: "Unknown actor searches should remain partial until an attributed source, victim, TTP, or indicator is captured.",
    caveats: ["Snippet-only mentions are not enough to create actor facts.", "Require captured-page, public-channel, or reviewed metadata support before ranking highly."],
    reviewFocus: ["low evidence count", "capture completeness", "false positives"]
  }
};

export function evaluateSearchQualityGate(input: SearchQualityGateInput): SearchQualityGateResult {
  const dto = input.dto;
  const caveatCodes = dto.caveats.map((caveat) => caveat.code);
  const qualityNoteCodes = calibrationQualityNotes(dto, input.calibration);
  const statuses = searchStatuses(input, caveatCodes, qualityNoteCodes);
  const status = statuses.sort((left, right) => QUALITY_STATUS_RANK.indexOf(left) - QUALITY_STATUS_RANK.indexOf(right))[0] ?? "partial";
  const score = qualityScore(dto, statuses);
  const reasons = reasonsFor(dto, statuses, caveatCodes, qualityNoteCodes, input.graphReviewState);
  const caveatPack = analystCaveatPackFor(dto.actor || dto.query);

  return {
    status,
    supportingStatuses: statuses,
    score,
    reasons,
    caveatCodes,
    qualityNoteCodes,
    caveatPack,
    apiWarnings: apiWarnings(statuses, caveatCodes, qualityNoteCodes)
  };
}

function calibrationQualityNotes(dto: LiveActorIntelligenceDto, calibration: ExtractionCalibrationReport | undefined): ExtractionQualityNoteCode[] {
  if (!calibration) return [];
  const activeStages = Object.entries(dto.datasets.evidenceStageCounts)
    .filter(([, count]) => Number(count) > 0)
    .map(([stage]) => stage);
  const notes = calibration.evidenceStageReports
    .filter((report) => activeStages.includes(report.evidenceStage))
    .flatMap((report) => report.qualityNotes.map((note) => note.code));
  return [...new Set(notes)];
}

export function analystCaveatPackFor(actor: string): AnalystCaveatPack {
  const normalized = actor.toLowerCase();
  return CAVEAT_PACKS[normalized] ?? CAVEAT_PACKS.unknown;
}

export function analystCaveatPacks(): AnalystCaveatPack[] {
  return Object.values(CAVEAT_PACKS);
}

export function buildSearchQualityApplyPlan(dto: LiveActorIntelligenceDto, gate: SearchQualityGateResult): SearchQualityApplyPlanDto {
  const actions: SearchQualityApplyActionDto[] = [];
  const evidenceIds = dto.provenance.map((item) => item.evidenceId);

  if (gate.supportingStatuses.includes("needs-review")) {
    actions.push(applyAction(
      "analyst_review",
      "Request analyst review",
      ["reviewer is assigned", "source provenance and caveats are visible"],
      evidenceIds,
      "keep public status at needs-review or partial until review completes",
      "create or update review queue items without changing graph facts",
      "close review item without applying confidence or graph changes",
      true
    ));
  }
  if (gate.supportingStatuses.includes("weak-evidence")) {
    actions.push(applyAction(
      "lower_confidence",
      "Lower confidence",
      ["quality score remains below promotion threshold", "no accepted graph review overrides the weak evidence"],
      evidenceIds,
      "lower ranked confidence and expose weak-evidence warning",
      "leave graph relationships proposed or downgraded",
      "restore previous confidence after stronger evidence is attached",
      false
    ));
  }
  if (gate.supportingStatuses.includes("insufficient-capture") || gate.supportingStatuses.includes("partial")) {
    actions.push(applyAction(
      "request_more_capture_evidence",
      "Request more capture evidence",
      ["canonical capture task can be queued or an approved source family exists", "current evidence remains partial"],
      evidenceIds,
      "keep result partial and request refresh/capture in the API response",
      "do not promote graph facts until durable capture or reviewed evidence exists",
      "cancel queued capture request if source becomes policy-blocked or duplicate",
      false
    ));
  }
  if (gate.qualityNoteCodes.includes("alias_collision") || dto.falsePositiveControls.some((reason) => /alias collision|rebrand overlap/i.test(reason))) {
    actions.push(applyAction(
      "suppress_noisy_alias",
      "Suppress noisy alias",
      ["alias collision is visible in caveats or false-positive controls", "suppression rule is scoped to this query/source evidence"],
      evidenceIds,
      "hide noisy alias from ranked facts while preserving caveat provenance",
      "keep alias relationship proposed or rejected until reviewed",
      "remove suppression rule and recompute profile from original evidence",
      true
    ));
  }
  if (gate.supportingStatuses.includes("contradicted")) {
    actions.push(applyAction(
      "mark_contradiction",
      "Mark contradiction",
      ["contradicted caveat or graph contradiction state is present", "conflicting evidence ids are preserved"],
      evidenceIds,
      "set quality status to contradicted and show critical warning",
      "mark affected graph relationships contradiction or needs-human-review",
      "remove contradiction marker only after reviewer accepts a superseding relationship",
      true
    ));
  }
  if (gate.supportingStatuses.includes("stale")) {
    actions.push(applyAction(
      "expire_stale_claim",
      "Expire stale claim",
      ["stale caveat or graph stale state is present", "no fresher accepted evidence supports the claim"],
      evidenceIds,
      "remove stale field from ranked summary and expose stale warning",
      "mark stale graph edge expired or downgraded",
      "restore stale claim only if fresher evidence is attached and reviewed",
      true
    ));
  }

  const canPromoteToReady = canPromote(gate, dto);
  if (canPromoteToReady) {
    actions.push(applyAction(
      "promote_quality_status",
      "Promote quality status",
      ["quality gate status is ready", "accepted graph review exists when graph relationships are involved", "durable captured, extracted, or reviewed evidence is present"],
      evidenceIds,
      "rank result as ready and clear partial/weak warning from primary status",
      "allow accepted graph facts to appear in UI panels and export previews",
      "revert to partial or needs-review if evidence is contradicted, stale, or downgraded",
      false
    ));
  }

  return {
    query: dto.query,
    currentStatus: gate.status,
    targetStatus: canPromoteToReady ? "ready" : gate.status,
    canPromoteToReady,
    actions
  };
}

export function buildSearchQualityApiDto(dto: LiveActorIntelligenceDto, gate: SearchQualityGateResult): SearchQualityApiDto {
  const applyPlan = buildSearchQualityApplyPlan(dto, gate);
  const aliasCollisionWarning = hasAliasCollisionWarning(dto, gate);
  const publicWarningCodes: SearchQualityPublicWarningCode[] = [
    ...gate.apiWarnings.map((warning) => warning.code),
    ...(aliasCollisionWarning ? ["alias_collision_warning" as const] : [])
  ];

  return {
    status: gate.status,
    score: gate.score,
    caveatCodes: gate.caveatCodes,
    qualityNoteCodes: gate.qualityNoteCodes,
    evidenceStageCounts: dto.datasets.evidenceStageCounts,
    analystActions: applyPlan.actions.map((action) => ({
      kind: action.kind,
      label: action.label,
      manualOnly: action.manualOnly,
      evidenceIds: action.evidenceIds
    })),
    canPromoteToReady: applyPlan.canPromoteToReady,
    publicWarningText: publicWarningText(dto, gate, aliasCollisionWarning),
    publicWarningCodes: [...new Set(publicWarningCodes)]
  };
}

export function buildSearchQualityDashboardDto(
  dto: LiveActorIntelligenceDto,
  gate: SearchQualityGateResult,
  generatedAt = new Date().toISOString()
): SearchQualityDashboardDto {
  const fields = dashboardFields(dto, gate);
  const actionable = fields.filter((field) => field.gate === "pass" || field.gate === "warn").length;
  const expectedFactRecall = fields.filter((field) => field.evidenceCount > 0).length / fields.length;
  const sourceFamilyDiversity = uniqueSourceFamilies(dto).length;
  const citationAvailability = dto.provenance.length === 0
    ? 0
    : dto.provenance.filter((item) => item.ledgerIds.length > 0 || item.captureId || item.url).length / dto.provenance.length;
  const holdReasons = [
    ...gate.reasons,
    ...fields.filter((field) => field.gate === "hold" || field.gate === "missing").map((field) => `${field.field}: ${field.reasons.join("; ")}`)
  ];
  const decision = gate.status === "ready" && fields.every((field) => field.gate !== "hold" && field.gate !== "missing")
    ? "promote"
    : gate.status === "contradicted" || fields.some((field) => field.gate === "hold")
      ? "hold"
      : "partial";

  return {
    schemaVersion: "ti.search_quality_dashboard.v1",
    query: dto.query,
    generatedAt,
    status: gate.status,
    score: gate.score,
    metrics: {
      usefulAnswerRate: roundRatio(actionable / fields.length),
      expectedFactRecall: roundRatio(expectedFactRecall),
      staleFactSuppression: gate.supportingStatuses.includes("stale") ? "hold" : "pass",
      contradictionHandling: gate.supportingStatuses.includes("contradicted") ? "hold" : "pass",
      sourceFamilyDiversity,
      evidenceCount: dto.provenance.length,
      citationAvailability: roundRatio(citationAvailability),
      freshnessScore: roundRatio(dto.recentActivity.freshnessScore)
    },
    releaseGate: {
      decision,
      reasons: uniqueStrings(holdReasons).slice(0, 12)
    },
    fields,
    reviewQueues: {
      sourceActivation: reviewQueueReasons(fields, "source_activation"),
      parserRepair: reviewQueueReasons(fields, "parser_repair"),
      graphReview: reviewQueueReasons(fields, "graph_review"),
      analystReview: reviewQueueReasons(fields, "analyst_review")
    }
  };
}

export function searchQualityApiExamples(): SearchQualityApiExampleDto[] {
  return [
    qualityExample("ready", "Ready Example", "ready", 0.86, { captured_page: 1, extracted_relationship: 1, reviewed_promoted: 1 }, [], []),
    qualityExample("partial", "Partial Example", "partial", 0.54, { live_discovery: 1 }, [], []),
    qualityExample("weak evidence", "Weak Evidence Example", "weak-evidence", 0.28, { live_discovery: 1 }, [], ["low_evidence_count"]),
    qualityExample("contradicted", "Contradicted Example", "contradicted", 0.2, { public_channel_message: 1 }, ["contradicted"], ["contradicted_attribution"]),
    qualityExample("stale", "Stale Example", "stale", 0.43, { captured_page: 1 }, ["stale"], ["stale_source"]),
    qualityExample("source biased", "Source Biased Example", "source-biased", 0.5, { public_channel_message: 1 }, [], ["source_family_bias"]),
    qualityExample("insufficient capture", "Insufficient Capture Example", "insufficient-capture", 0.46, { live_discovery: 2 }, [], []),
    qualityExample("needs review", "Needs Review Example", "needs-review", 0.58, { metadata_only_claim: 1 }, ["metadata_only_leak_claim"], ["weak_victim_claim"])
  ];
}

function searchStatuses(
  input: SearchQualityGateInput,
  caveatCodes: TiConfidenceCaveatCode[],
  qualityNoteCodes: ExtractionQualityNoteCode[]
): SearchQualityStatus[] {
  const dto = input.dto;
  const statuses = new Set<SearchQualityStatus>();
  const stageCounts = dto.datasets.evidenceStageCounts;
  const capturedSupport = stageCounts.captured_page + stageCounts.reviewed_promoted + stageCounts.extracted_relationship;
  const partialSupport = stageCounts.live_discovery + stageCounts.public_channel_message + stageCounts.metadata_only_claim + stageCounts.seeded;

  if (input.graphReviewState === "contradiction" || caveatCodes.includes("contradicted")) statuses.add("contradicted");
  if (input.graphReviewState === "stale" || caveatCodes.includes("stale") || qualityNoteCodes.includes("stale_source")) statuses.add("stale");
  if (qualityNoteCodes.includes("source_family_bias") || singlePartialSourceFamily(stageCounts)) statuses.add("source-biased");
  if (capturedSupport === 0 && partialSupport > 0) statuses.add("insufficient-capture");
  if (dto.confidence < 0.35 || qualityNoteCodes.includes("low_evidence_count") || dto.datasets.entityCount + dto.datasets.indicatorCount < 2) statuses.add("weak-evidence");
  if (dto.needsAnalystReview || input.graphReviewState === "needs-human-review" || qualityNoteCodes.includes("weak_victim_claim") || qualityNoteCodes.includes("extracted_ttp_needs_review")) statuses.add("needs-review");
  if (partialSupport > 0 || dto.caveats.some((caveat) => caveat.severity !== "info")) statuses.add("partial");
  if (statuses.size === 0 && dto.confidence >= 0.65 && capturedSupport > 0) statuses.add("ready");
  if (input.graphReviewState === "accepted" && dto.confidence >= 0.65 && capturedSupport > 0 && !statuses.has("contradicted") && !statuses.has("stale")) statuses.add("ready");

  return [...statuses];
}

function applyAction(
  kind: SearchQualityApplyActionKind,
  label: string,
  prerequisites: string[],
  evidenceIds: string[],
  expectedApiEffect: string,
  graphEffect: string,
  rollback: string,
  manualOnly: boolean
): SearchQualityApplyActionDto {
  return { kind, label, prerequisites, evidenceIds, expectedApiEffect, graphEffect, rollback, manualOnly };
}

function canPromote(gate: SearchQualityGateResult, dto: LiveActorIntelligenceDto): boolean {
  const durableEvidence = dto.datasets.evidenceStageCounts.captured_page
    + dto.datasets.evidenceStageCounts.extracted_relationship
    + dto.datasets.evidenceStageCounts.reviewed_promoted > 0;
  return gate.status === "ready"
    && durableEvidence
    && !gate.supportingStatuses.some((status) => status !== "ready")
    && gate.score >= 0.65;
}

function qualityScore(dto: LiveActorIntelligenceDto, statuses: SearchQualityStatus[]): number {
  const penalties: Partial<Record<SearchQualityStatus, number>> = {
    contradicted: 0.5,
    stale: 0.25,
    "source-biased": 0.15,
    "insufficient-capture": 0.2,
    "weak-evidence": 0.25,
    "needs-review": 0.12,
    partial: 0.08
  };
  const penalty = Math.min(0.35, statuses.reduce((total, status) => total + (penalties[status] ?? 0), 0));
  const durableBoost = dto.datasets.evidenceStageCounts.captured_page + dto.datasets.evidenceStageCounts.extracted_relationship + dto.datasets.evidenceStageCounts.reviewed_promoted > 0 ? 0.2 : 0;
  return Math.max(0, Math.min(1, dto.confidence + durableBoost - penalty));
}

function reasonsFor(
  dto: LiveActorIntelligenceDto,
  statuses: SearchQualityStatus[],
  caveatCodes: TiConfidenceCaveatCode[],
  qualityNoteCodes: ExtractionQualityNoteCode[],
  graphReviewState?: GraphReviewState
): string[] {
  return [
    ...statuses.map((status) => statusReason(status)),
    ...(graphReviewState ? [`graph review state: ${graphReviewState}`] : []),
    ...(caveatCodes.length ? [`confidence caveats: ${caveatCodes.join(", ")}`] : []),
    ...(qualityNoteCodes.length ? [`quality notes: ${qualityNoteCodes.join(", ")}`] : []),
    ...dto.falsePositiveControls
  ];
}

function statusReason(status: SearchQualityStatus): string {
  const reasons: Record<SearchQualityStatus, string> = {
    ready: "evidence is sufficiently captured and confident for ranked intelligence",
    partial: "result includes partial or caveated evidence",
    "weak-evidence": "evidence volume or confidence is weak",
    "needs-review": "analyst review is required before promotion",
    contradicted: "contradicted attribution or relationship signal is present",
    stale: "stale source or graph state is present",
    "source-biased": "source family coverage is narrow or biased",
    "insufficient-capture": "captured-page or reviewed evidence is insufficient"
  };
  return reasons[status];
}

function apiWarnings(
  statuses: SearchQualityStatus[],
  caveatCodes: TiConfidenceCaveatCode[],
  qualityNoteCodes: ExtractionQualityNoteCode[]
): SearchQualityGateResult["apiWarnings"] {
  return [
    ...statuses.filter((status) => status !== "ready").map((status) => ({
      code: status,
      message: statusReason(status),
      severity: status === "contradicted" ? "critical" as const : "warning" as const
    })),
    ...caveatCodes.map((code) => ({
      code,
      message: `confidence caveat: ${code}`,
      severity: code === "contradicted" || code === "metadata_only_leak_claim" ? "critical" as const : "warning" as const
    })),
    ...qualityNoteCodes.map((code) => ({
      code,
      message: `quality note: ${code}`,
      severity: code === "contradicted_attribution" ? "critical" as const : "warning" as const
    }))
  ];
}

function publicWarningText(dto: LiveActorIntelligenceDto, gate: SearchQualityGateResult, aliasCollisionWarning: boolean): string[] {
  const messages = gate.apiWarnings.map((warning) => warning.message);
  if (aliasCollisionWarning) {
    messages.push("actor aliases or ransomware rebrand overlap require analyst review before public promotion");
  }
  if (!gate.apiWarnings.length && gate.status === "ready") {
    messages.push("quality gate is ready with durable or reviewed evidence");
  }
  if (!gate.apiWarnings.length && gate.status !== "ready") {
    messages.push(statusReason(gate.status));
  }
  return [...new Set(messages.concat(dto.falsePositiveControls))];
}

function hasAliasCollisionWarning(dto: LiveActorIntelligenceDto, gate: SearchQualityGateResult): boolean {
  return gate.qualityNoteCodes.includes("alias_collision")
    || dto.falsePositiveControls.some((reason) => /alias collision|rebrand overlap/i.test(reason));
}

function qualityExample(
  name: string,
  query: string,
  status: SearchQualityStatus,
  score: number,
  stageOverrides: Partial<Record<EvidenceStage, number>>,
  caveatCodes: TiConfidenceCaveatCode[],
  qualityNoteCodes: ExtractionQualityNoteCode[]
): SearchQualityApiExampleDto {
  const evidenceStageCounts = zeroEvidenceStageCounts();
  for (const [stage, count] of Object.entries(stageOverrides) as Array<[EvidenceStage, number]>) {
    evidenceStageCounts[stage] = count;
  }
  const analystActions = exampleAnalystActions(status, caveatCodes, qualityNoteCodes);
  const ready = status === "ready";
  const quality: SearchQualityApiDto = {
    status,
    score,
    caveatCodes,
    qualityNoteCodes,
    evidenceStageCounts,
    analystActions,
    canPromoteToReady: ready,
    publicWarningText: ready ? ["quality gate is ready with durable or reviewed evidence"] : [statusReason(status)],
    publicWarningCodes: ready ? [] : [status, ...caveatCodes, ...qualityNoteCodes]
  };
  const exampleDto = exampleLiveActorDto(query, score, evidenceStageCounts, caveatCodes);
  const gate: SearchQualityGateResult = {
    status,
    supportingStatuses: [status],
    score,
    reasons: ready ? ["evidence is sufficiently captured and confident for ranked intelligence"] : [statusReason(status)],
    caveatCodes,
    qualityNoteCodes,
    caveatPack: analystCaveatPackFor(query),
    apiWarnings: ready ? [] : [{
      code: status,
      message: statusReason(status),
      severity: status === "contradicted" ? "critical" : "warning"
    }]
  };
  return {
    name,
    query,
    quality,
    dashboard: buildSearchQualityDashboardDto(exampleDto, gate, "2026-05-24T00:00:00.000Z")
  };
}

function zeroEvidenceStageCounts(): Record<EvidenceStage, number> {
  return {
    seeded: 0,
    live_discovery: 0,
    public_channel_message: 0,
    metadata_only_claim: 0,
    captured_page: 0,
    extracted_relationship: 0,
    reviewed_promoted: 0
  };
}

function exampleAnalystActions(
  status: SearchQualityStatus,
  caveatCodes: TiConfidenceCaveatCode[],
  qualityNoteCodes: ExtractionQualityNoteCode[]
): SearchQualityAnalystActionSummaryDto[] {
  const evidenceIds = [`example-${status}`];
  const actionKinds: SearchQualityApplyActionKind[] = [];
  if (status === "needs-review" || qualityNoteCodes.includes("weak_victim_claim")) actionKinds.push("analyst_review");
  if (status === "weak-evidence") actionKinds.push("lower_confidence");
  if (status === "partial" || status === "insufficient-capture" || status === "source-biased") actionKinds.push("request_more_capture_evidence");
  if (status === "contradicted" || caveatCodes.includes("contradicted")) actionKinds.push("mark_contradiction");
  if (status === "stale" || caveatCodes.includes("stale")) actionKinds.push("expire_stale_claim");
  if (status === "ready") actionKinds.push("promote_quality_status");
  return actionKinds.map((kind) => ({
    kind,
    label: kind.replaceAll("_", " "),
    manualOnly: ["analyst_review", "mark_contradiction", "expire_stale_claim", "suppress_noisy_alias"].includes(kind),
    evidenceIds
  }));
}

function singlePartialSourceFamily(stageCounts: Record<EvidenceStage, number>): boolean {
  const partialFamilies = [
    stageCounts.public_channel_message,
    stageCounts.metadata_only_claim,
    stageCounts.seeded
  ].filter((count) => count > 0).length;
  const durableFamilies = stageCounts.captured_page + stageCounts.extracted_relationship + stageCounts.reviewed_promoted;
  return partialFamilies === 1 && durableFamilies === 0;
}

function dashboardFields(dto: LiveActorIntelligenceDto, gate: SearchQualityGateResult): SearchQualityFieldGateDto[] {
  return [
    fieldGate("actor_summary", dto.summaryBullets.length, dto.confidence, dto, gate, dto.summaryBullets.length ? [] : ["summary is missing"]),
    fieldGate("aliases", dto.aliases.length, dto.confidence, dto, gate, dto.aliases.length ? [] : ["no aliases extracted"]),
    fieldGate("recent_activity", dto.recentActivity.notes.length || dto.recentActivity.lastSeen ? 1 : 0, dto.recentActivity.freshnessScore, dto, gate, gate.supportingStatuses.includes("stale") ? ["recent activity is stale or graph-stale"] : []),
    fieldGate("targets", dto.targets.victims.length, fieldReadinessConfidence(dto, "victims"), dto, gate, dto.targets.victims.length ? [] : ["no victim or target claims ready"]),
    fieldGate("sectors", dto.targets.sectors.length, fieldReadinessConfidence(dto, "sectors"), dto, gate, dto.targets.sectors.length ? [] : ["no sector claims extracted"]),
    fieldGate("countries", dto.targets.regions.length, fieldReadinessConfidence(dto, "regions"), dto, gate, dto.targets.regions.length ? [] : ["no country or region claims extracted"]),
    fieldGate("tools_malware", dto.malwareTools.length, fieldReadinessConfidence(dto, "malware_tools"), dto, gate, dto.malwareTools.length ? [] : ["no malware/tool claims extracted"]),
    fieldGate("cves", dto.vulnerabilities.length, fieldReadinessConfidence(dto, "vulnerabilities"), dto, gate, dto.vulnerabilities.length ? [] : ["no CVE claims extracted"]),
    fieldGate("ttps", dto.ttps.length, fieldReadinessConfidence(dto, "ttps"), dto, gate, dto.ttps.length ? [] : ["no TTP claims extracted"]),
    fieldGate("campaigns", dto.campaigns.length, dto.confidence, dto, gate, dto.campaigns.length ? [] : ["no campaign names extracted"]),
    fieldGate("infrastructure", dto.infrastructure.length, fieldReadinessConfidence(dto, "infrastructure"), dto, gate, dto.infrastructure.length ? [] : ["no infrastructure indicators extracted"]),
    fieldGate("datasets", dto.datasets.coverage.length, dto.confidence, dto, gate, dto.datasets.coverage.length ? [] : ["dataset coverage is missing"]),
    fieldGate("victim_company_claims", dto.targets.victims.length, fieldReadinessConfidence(dto, "victims"), dto, gate, gate.qualityNoteCodes.includes("weak_victim_claim") ? ["victim/company claims need analyst review"] : []),
    fieldGate("iocs", dto.datasets.indicatorCount, dto.confidence, dto, gate, dto.datasets.indicatorCount ? [] : ["no IOCs extracted"]),
    fieldGate("confidence", dto.confidence >= 0.35 ? 1 : 0, dto.confidence, dto, gate, gate.supportingStatuses.includes("weak-evidence") ? ["confidence below useful-answer threshold"] : []),
    fieldGate("freshness", dto.recentActivity.freshnessScore > 0 ? 1 : 0, dto.recentActivity.freshnessScore, dto, gate, gate.supportingStatuses.includes("stale") ? ["stale facts suppressed from ready promotion"] : []),
    fieldGate("provenance", dto.provenance.length, dto.provenance.length ? 1 : 0, dto, gate, dto.provenance.length ? [] : ["no provenance records attached"])
  ];
}

function fieldGate(
  field: SearchQualityDashboardField,
  evidenceCount: number,
  confidence: number,
  dto: LiveActorIntelligenceDto,
  gate: SearchQualityGateResult,
  fieldReasons: string[]
): SearchQualityFieldGateDto {
  const citationCount = dto.provenance.filter((item) => item.ledgerIds.length > 0 || item.captureId || item.url).length;
  const reasons = uniqueStrings([
    ...fieldReasons,
    ...(gate.supportingStatuses.includes("contradicted") ? ["contradicted evidence prevents promotion"] : []),
    ...(gate.supportingStatuses.includes("source-biased") ? ["source-family diversity below target"] : []),
    ...(evidenceCount === 0 ? ["field has no supporting extracted evidence"] : []),
    ...(confidence < 0.35 ? ["field confidence is low"] : [])
  ]);
  const gateState: SearchQualityDashboardGate = gate.supportingStatuses.includes("contradicted")
    ? "hold"
    : evidenceCount === 0
      ? "missing"
      : confidence < 0.35 || reasons.some((reason) => /stale|source-family|review|low/i.test(reason))
        ? "warn"
        : "pass";
  return {
    field,
    gate: gateState,
    confidence: roundRatio(confidence),
    evidenceCount,
    citationCount,
    freshnessScore: roundRatio(dto.recentActivity.freshnessScore),
    reasons,
    feedbackTargets: feedbackTargets(gateState, reasons, field)
  };
}

function feedbackTargets(
  gate: SearchQualityDashboardGate,
  reasons: string[],
  field: SearchQualityDashboardField
): SearchQualityFieldGateDto["feedbackTargets"] {
  const targets = new Set<SearchQualityFieldGateDto["feedbackTargets"][number]>();
  if (gate === "missing") targets.add("source_activation");
  if (reasons.some((reason) => /no .*extracted|parser|IOC|CVE|TTP|malware|infrastructure/i.test(reason))) targets.add("parser_repair");
  if (reasons.some((reason) => /contradicted|stale|source-family/i.test(reason))) targets.add("graph_review");
  if (reasons.some((reason) => /review|victim|company|low/i.test(reason))) targets.add("analyst_review");
  if (gate === "hold" || gate === "missing" || field === "confidence" || field === "freshness") targets.add("public_answer_hold");
  return [...targets];
}

function reviewQueueReasons(
  fields: SearchQualityFieldGateDto[],
  target: SearchQualityFieldGateDto["feedbackTargets"][number]
): string[] {
  return fields
    .filter((field) => field.feedbackTargets.includes(target))
    .map((field) => `${field.field}: ${field.reasons[0] ?? field.gate}`)
    .slice(0, 12);
}

function uniqueSourceFamilies(dto: LiveActorIntelligenceDto): string[] {
  return uniqueStrings(dto.provenance.map((item) => item.sourceId.split("_").slice(0, 3).join("_") || item.sourceId));
}

function fieldReadinessConfidence(dto: LiveActorIntelligenceDto, field: keyof LiveActorIntelligenceDto["readiness"]["fields"]): number {
  return dto.readiness.fields[field]?.confidence ?? dto.confidence;
}

function roundRatio(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function exampleLiveActorDto(
  query: string,
  confidence: number,
  evidenceStageCounts: Record<EvidenceStage, number>,
  caveatCodes: TiConfidenceCaveatCode[]
): LiveActorIntelligenceDto {
  const evidenceCount = Object.values(evidenceStageCounts).reduce((sum, count) => sum + count, 0);
  const readinessFields = {
    summary: readinessField("summary", confidence, evidenceCount),
    aliases: readinessField("aliases", confidence, evidenceCount),
    recent_activity: readinessField("recent_activity", confidence, evidenceCount),
    timeline_changes: readinessField("timeline_changes", confidence, evidenceCount),
    targets: readinessField("targets", confidence, evidenceCount),
    victims: readinessField("victims", confidence, evidenceStageCounts.metadata_only_claim),
    sectors: readinessField("sectors", confidence, evidenceCount),
    regions: readinessField("regions", confidence, evidenceCount),
    ttps: readinessField("ttps", confidence, evidenceCount),
    malware_tools: readinessField("malware_tools", confidence, evidenceCount),
    vulnerabilities: readinessField("vulnerabilities", confidence, evidenceCount),
    infrastructure: readinessField("infrastructure", confidence, evidenceCount),
    datasets: readinessField("datasets", confidence, evidenceCount)
  } satisfies LiveActorIntelligenceDto["readiness"]["fields"];
  return {
    query,
    actor: query,
    summaryBullets: evidenceCount ? [`${query} has evidence for quality evaluation.`] : [],
    aliases: query === "Ready Example" ? ["Example Alias"] : [],
    recentActivity: { freshnessScore: confidence, notes: evidenceCount ? ["example freshness signal"] : [] },
    targets: { victims: evidenceStageCounts.metadata_only_claim ? ["Example Victim"] : [], sectors: evidenceCount ? ["technology"] : [], regions: evidenceCount ? ["global"] : [] },
    campaigns: evidenceCount ? ["example campaign"] : [],
    ttps: evidenceCount ? ["phishing"] : [],
    infrastructure: [],
    malwareTools: evidenceCount ? ["example tool"] : [],
    vulnerabilities: evidenceCount ? ["CVE-2026-0001"] : [],
    datasets: { coverage: ["example"], sourceCount: evidenceCount, indicatorCount: evidenceCount, entityCount: evidenceCount, evidenceStageCounts },
    caveats: caveatCodes.map((code): TiConfidenceCaveat => ({
      code,
      label: code.replaceAll("_", " "),
      severity: code === "contradicted" ? "critical" : "warning",
      reason: code,
      grounding: []
    })),
    confidence,
    provenance: Array.from({ length: evidenceCount }, (_, index) => ({
      evidenceId: `example-evidence-${index + 1}`,
      ledgerIds: [`ledger-${index + 1}`],
      sourceId: `example_source_${index + 1}`,
      captureId: `cap_${index + 1}`,
      evidenceStage: "captured_page" as EvidenceStage,
      grounding: [],
      confidence
    })),
    profileDeltas: [],
    falsePositiveControls: [],
    readiness: {
      overall: confidence >= 0.65 ? "fact" as const : "partial_evidence" as const,
      fields: readinessFields,
      downgradeReasons: [],
      sourceFamilyCount: Math.max(1, evidenceCount),
      evidenceStageCounts
    },
    needsAnalystReview: false
  };
}

function readinessField(field: keyof LiveActorIntelligenceDto["readiness"]["fields"], confidence: number, evidenceCount: number): LiveActorIntelligenceDto["readiness"]["fields"][typeof field] {
  return {
    field,
    status: confidence >= 0.65 && evidenceCount > 0 ? "fact" as const : evidenceCount > 0 ? "partial_evidence" as const : "needs_review" as const,
    confidence,
    evidenceIds: Array.from({ length: evidenceCount }, (_, index) => `example-evidence-${index + 1}`),
    provenance: [],
    caveatCodes: [],
    reasons: evidenceCount ? [] : ["field has no supporting extracted evidence"]
  };
}
