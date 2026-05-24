import { actorAliasesFor } from "./actorAliases.ts";
import { buildActorQueryExtractionProfile, type EvidenceStage, type StagedEvidenceInput } from "./intelligenceProfiles.ts";
import { stableId, uniqueStrings } from "../utils.ts";

export type TimelinessQueryClass = "high_activity_actor" | "actor" | "ransomware" | "cve" | "malware_tool" | "unknown";
export type TimelinessFieldName = "recent_activity" | "source_freshness" | "victim_claims" | "ttps" | "malware_tools" | "cves" | "infrastructure";
export type TimelinessStatus = "current" | "aging" | "stale" | "unknown";

export interface TimelinessFieldScoreDto {
  field: TimelinessFieldName;
  status: TimelinessStatus;
  score: number;
  latestObservedAt?: string;
  expectedMaxAgeDays: number;
  evidenceIds: string[];
  sourceIds: string[];
  reasons: string[];
}

export interface TimelinessGroundTruthHarnessDto {
  schemaVersion: "ti.timeliness_ground_truth.v1";
  query: string;
  queryClass: TimelinessQueryClass;
  generatedAt: string;
  expectations: {
    maxAgeDays: number;
    highActivityActor: boolean;
    requiresFreshSource: boolean;
    staleCannotBeLatest: boolean;
  };
  latest: {
    latestSourceAt?: string;
    latestClaimAt?: string;
    latestEvidenceStage?: EvidenceStage;
    freshnessScore: number;
  };
  fields: TimelinessFieldScoreDto[];
  gaps: Array<{
    code: "no_evidence" | "no_recent_activity" | "stale_latest_source" | "stale_field" | "single_source_latest" | "metadata_only_latest";
    message: string;
    field?: TimelinessFieldName;
    evidenceIds: string[];
  }>;
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

export type ActorFreshnessCadence = "daily" | "weekly";
export type ActorFreshnessState = "current" | "aging" | "stale" | "unknown";

export interface HighPriorityActorFreshnessRowDto {
  id: string;
  actor: string;
  aliases: string[];
  priority: "critical" | "high";
  cadence: {
    expected: ActorFreshnessCadence;
    targetMaxAgeDays: number;
    nextReviewDueAt: string;
  };
  latest: {
    latestSourceAt?: string;
    latestClaimAt?: string;
    latestEvidenceStage?: EvidenceStage;
    freshnessScore: number;
  };
  states: {
    overall: ActorFreshnessState;
    recentActivity: TimelinessStatus;
    sourceFreshness: TimelinessStatus;
    publicAnswerState: "ready" | "partial" | "review_required" | "searching";
    blocksReadyPromotion: boolean;
  };
  evidenceIds: string[];
  sourceIds: string[];
  reasons: string[];
  handoffs: {
    agent01SourceReliability?: string;
    agent02SchedulerCadence?: string;
    agent04SourceGap?: string;
    agent06EvidenceReplay?: string;
    agent09ApiField?: string;
    agent10ReleaseGate?: string;
  };
}

export interface HighPriorityActorFreshnessDashboardDto {
  schemaVersion: "ti.high_priority_actor_freshness_dashboard.v1";
  query: string;
  generatedAt: string;
  actors: HighPriorityActorFreshnessRowDto[];
  summary: {
    actorCount: number;
    currentCount: number;
    agingCount: number;
    staleCount: number;
    unknownCount: number;
    dailyDueCount: number;
    weeklyDueCount: number;
    readyPromotionHoldCount: number;
  };
  queues: {
    dailyRefresh: string[];
    weeklyRefresh: string[];
    staleAnswerHolds: string[];
    missingEvidence: string[];
    sourceGapReview: string[];
  };
  routing: {
    agent01SourceReliability: string[];
    agent02SchedulerCadence: string[];
    agent04FreshnessSourceGaps: string[];
    agent06EvidenceReplay: string[];
    agent09ApiFields: string[];
    agent10ReleaseGates: string[];
  };
  policy: {
    preservesUncertainty: true;
    staleCannotBeLatest: true;
    unknownActorSearchingOnly: true;
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

const HIGH_ACTIVITY_ACTORS = new Set(["apt29", "apt42", "turla", "volt typhoon", "scattered spider", "akira", "lockbit"]);
const RANSOMWARE = new Set(["akira", "lockbit", "clop", "alphv", "blackcat", "black cat"]);
const DEFAULT_HIGH_PRIORITY_ACTORS: Array<{ actor: string; priority: "critical" | "high"; cadence: ActorFreshnessCadence; targetMaxAgeDays: number }> = [
  { actor: "APT29", priority: "critical", cadence: "daily", targetMaxAgeDays: 14 },
  { actor: "APT42", priority: "critical", cadence: "daily", targetMaxAgeDays: 14 },
  { actor: "Sandworm", priority: "critical", cadence: "daily", targetMaxAgeDays: 14 },
  { actor: "Volt Typhoon", priority: "critical", cadence: "daily", targetMaxAgeDays: 14 },
  { actor: "Lazarus", priority: "high", cadence: "weekly", targetMaxAgeDays: 21 },
  { actor: "Turla", priority: "high", cadence: "weekly", targetMaxAgeDays: 21 },
  { actor: "LockBit", priority: "high", cadence: "daily", targetMaxAgeDays: 7 },
  { actor: "Akira", priority: "high", cadence: "daily", targetMaxAgeDays: 7 }
];

export function buildTimelinessGroundTruthHarnessDto(input: {
  query: string;
  evidence: StagedEvidenceInput[];
  generatedAt?: string;
}): TimelinessGroundTruthHarnessDto {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const queryClass = classifyQuery(input.query);
  const expectedMaxAgeDays = maxAgeDaysFor(queryClass);
  const latestSourceAt = latest(input.evidence.map((item) => item.result.capture.publishedAt ?? item.result.capture.collectedAt));
  const profileDates = input.evidence.map((item) => buildActorQueryExtractionProfile(input.query, item.result).temporal);
  const latestClaimAt = latest(profileDates.flatMap((temporal) => [temporal.lastSeenAt, temporal.reportPublishedAt, temporal.incidentDate, temporal.firstSeenAt]));
  const latestStage = input.evidence.find((item) => (item.result.capture.publishedAt ?? item.result.capture.collectedAt) === latestSourceAt)?.stage;
  const fields = buildFieldScores(input.evidence, generatedAt, expectedMaxAgeDays, profileDates);
  const gaps = buildGaps(input.evidence, fields, queryClass);
  const holdsReadyPromotion = gaps.some((gap) =>
    gap.code === "no_evidence" || gap.code === "no_recent_activity" || gap.code === "stale_latest_source" || gap.code === "metadata_only_latest"
  ) || fields.some((field) => field.status === "stale" && (field.field === "recent_activity" || field.field === "source_freshness"));
  return {
    schemaVersion: "ti.timeliness_ground_truth.v1",
    query: input.query,
    queryClass,
    generatedAt,
    expectations: {
      maxAgeDays: expectedMaxAgeDays,
      highActivityActor: queryClass === "high_activity_actor",
      requiresFreshSource: queryClass === "high_activity_actor" || queryClass === "ransomware" || queryClass === "cve",
      staleCannotBeLatest: queryClass === "high_activity_actor"
    },
    latest: {
      latestSourceAt,
      latestClaimAt,
      latestEvidenceStage: latestStage,
      freshnessScore: freshnessScore(latestSourceAt, generatedAt, expectedMaxAgeDays)
    },
    fields,
    gaps,
    releaseImpact: {
      publicAnswerState: holdsReadyPromotion ? "partial" : fields.some((field) => field.status === "aging" || field.status === "unknown") ? "partial" : "ready",
      holdsReadyPromotion,
      caveats: releaseCaveats(gaps, fields, queryClass)
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      preservesUncertainty: true
    }
  };
}

export function buildHighPriorityActorFreshnessDashboardDto(input: {
  query: string;
  generatedAt?: string;
  timelinessGroundTruth?: TimelinessGroundTruthHarnessDto;
  monitoredActors?: Array<{ actor: string; priority?: "critical" | "high"; cadence?: ActorFreshnessCadence; targetMaxAgeDays?: number }>;
}): HighPriorityActorFreshnessDashboardDto {
  const generatedAt = input.generatedAt ?? input.timelinessGroundTruth?.generatedAt ?? new Date().toISOString();
  const actors = (input.monitoredActors ?? DEFAULT_HIGH_PRIORITY_ACTORS).map((actorConfig) => {
    const cadence = actorConfig.cadence ?? (actorConfig.priority === "critical" ? "daily" : "weekly");
    const targetMaxAgeDays = actorConfig.targetMaxAgeDays ?? (cadence === "daily" ? 14 : 21);
    const matched = queryMatchesActor(input.query, actorConfig.actor);
    return actorFreshnessRow({
      actor: actorConfig.actor,
      priority: actorConfig.priority ?? (cadence === "daily" ? "critical" : "high"),
      cadence,
      targetMaxAgeDays,
      generatedAt,
      timeliness: matched ? input.timelinessGroundTruth : undefined
    });
  });
  return {
    schemaVersion: "ti.high_priority_actor_freshness_dashboard.v1",
    query: input.query,
    generatedAt,
    actors,
    summary: {
      actorCount: actors.length,
      currentCount: actors.filter((row) => row.states.overall === "current").length,
      agingCount: actors.filter((row) => row.states.overall === "aging").length,
      staleCount: actors.filter((row) => row.states.overall === "stale").length,
      unknownCount: actors.filter((row) => row.states.overall === "unknown").length,
      dailyDueCount: actors.filter((row) => row.cadence.expected === "daily" && row.states.overall !== "current").length,
      weeklyDueCount: actors.filter((row) => row.cadence.expected === "weekly" && row.states.overall !== "current").length,
      readyPromotionHoldCount: actors.filter((row) => row.states.blocksReadyPromotion).length
    },
    queues: {
      dailyRefresh: actors.filter((row) => row.cadence.expected === "daily" && row.states.overall !== "current").map((row) => row.id),
      weeklyRefresh: actors.filter((row) => row.cadence.expected === "weekly" && row.states.overall !== "current").map((row) => row.id),
      staleAnswerHolds: actors.filter((row) => row.states.blocksReadyPromotion).map((row) => row.id),
      missingEvidence: actors.filter((row) => row.states.overall === "unknown").map((row) => row.id),
      sourceGapReview: actors.filter((row) => row.sourceIds.length < 2 || row.states.overall === "stale").map((row) => row.id)
    },
    routing: {
      agent01SourceReliability: idsWithHandoff(actors, "agent01SourceReliability"),
      agent02SchedulerCadence: idsWithHandoff(actors, "agent02SchedulerCadence"),
      agent04FreshnessSourceGaps: idsWithHandoff(actors, "agent04SourceGap"),
      agent06EvidenceReplay: idsWithHandoff(actors, "agent06EvidenceReplay"),
      agent09ApiFields: idsWithHandoff(actors, "agent09ApiField"),
      agent10ReleaseGates: idsWithHandoff(actors, "agent10ReleaseGate")
    },
    policy: {
      preservesUncertainty: true,
      staleCannotBeLatest: true,
      unknownActorSearchingOnly: true,
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

function actorFreshnessRow(input: {
  actor: string;
  priority: "critical" | "high";
  cadence: ActorFreshnessCadence;
  targetMaxAgeDays: number;
  generatedAt: string;
  timeliness?: TimelinessGroundTruthHarnessDto;
}): HighPriorityActorFreshnessRowDto {
  const recent = input.timeliness?.fields.find((field) => field.field === "recent_activity");
  const source = input.timeliness?.fields.find((field) => field.field === "source_freshness");
  const latestSourceAt = input.timeliness?.latest.latestSourceAt;
  const latestClaimAt = input.timeliness?.latest.latestClaimAt;
  const sourceAge = latestSourceAt ? ageDays(latestSourceAt, input.generatedAt) : Number.POSITIVE_INFINITY;
  const overall = freshnessState({
    sourceStatus: source?.status ?? "unknown",
    recentStatus: recent?.status ?? "unknown",
    sourceAge,
    targetMaxAgeDays: input.targetMaxAgeDays,
    hasEvidence: (source?.evidenceIds.length ?? 0) > 0 || (recent?.evidenceIds.length ?? 0) > 0
  });
  const blocksReadyPromotion = overall === "stale" || overall === "unknown" || input.timeliness?.releaseImpact.holdsReadyPromotion === true;
  const evidenceIds = uniqueStrings([
    ...(recent?.evidenceIds ?? []),
    ...(source?.evidenceIds ?? []),
    ...(input.timeliness?.gaps.flatMap((gap) => gap.evidenceIds) ?? [])
  ]).slice(0, 12);
  const sourceIds = uniqueStrings([
    ...(recent?.sourceIds ?? []),
    ...(source?.sourceIds ?? [])
  ]).slice(0, 12);
  return {
    id: stableId("high-priority-actor-freshness", `${input.actor}:${input.generatedAt}`),
    actor: input.actor,
    aliases: actorAliasesFor(input.actor).slice(0, 8),
    priority: input.priority,
    cadence: {
      expected: input.cadence,
      targetMaxAgeDays: input.targetMaxAgeDays,
      nextReviewDueAt: nextReviewDueAt(latestSourceAt, input.generatedAt, input.cadence)
    },
    latest: {
      latestSourceAt,
      latestClaimAt,
      latestEvidenceStage: input.timeliness?.latest.latestEvidenceStage,
      freshnessScore: input.timeliness?.latest.freshnessScore ?? 0
    },
    states: {
      overall,
      recentActivity: recent?.status ?? "unknown",
      sourceFreshness: source?.status ?? "unknown",
      publicAnswerState: input.timeliness
        ? input.timeliness.releaseImpact.publicAnswerState
        : "searching",
      blocksReadyPromotion
    },
    evidenceIds,
    sourceIds,
    reasons: actorFreshnessReasons(input.actor, overall, input.cadence, input.targetMaxAgeDays, sourceAge, input.timeliness),
    handoffs: {
      agent01SourceReliability: sourceIds.length < 2 ? "review source-family support before ready wording" : undefined,
      agent02SchedulerCadence: overall !== "current" ? `schedule ${input.cadence} refresh for high-priority actor` : undefined,
      agent04SourceGap: sourceIds.length < 2 || overall === "unknown" ? "fill public source gap with approved safe sources" : undefined,
      agent06EvidenceReplay: evidenceIds.length > 0 ? "replay latest evidence before freshness promotion" : undefined,
      agent09ApiField: "highPriorityActorFreshnessDashboard",
      agent10ReleaseGate: blocksReadyPromotion ? "hold ready public answer until freshness gate passes" : undefined
    }
  };
}

function freshnessState(input: {
  sourceStatus: TimelinessStatus;
  recentStatus: TimelinessStatus;
  sourceAge: number;
  targetMaxAgeDays: number;
  hasEvidence: boolean;
}): ActorFreshnessState {
  if (!input.hasEvidence) return "unknown";
  if (input.sourceStatus === "stale" || input.recentStatus === "stale" || input.sourceAge > input.targetMaxAgeDays * 2) return "stale";
  if (input.sourceStatus === "aging" || input.recentStatus === "aging" || input.sourceAge > input.targetMaxAgeDays) return "aging";
  return "current";
}

function actorFreshnessReasons(
  actor: string,
  state: ActorFreshnessState,
  cadence: ActorFreshnessCadence,
  targetMaxAgeDays: number,
  sourceAge: number,
  timeliness: TimelinessGroundTruthHarnessDto | undefined
): string[] {
  return [
    `${actor} is tracked on a ${cadence} freshness cadence`,
    Number.isFinite(sourceAge) ? `latest source material is ${sourceAge} day(s) old against ${targetMaxAgeDays} day target` : "no current evidence is available for this actor in the dashboard context",
    ...(timeliness?.releaseImpact.caveats ?? []),
    ...(state === "stale" ? ["stale evidence cannot be used as latest activity"] : []),
    ...(state === "unknown" ? ["public answer must remain Searching or partial until evidence arrives"] : [])
  ].slice(0, 10);
}

function nextReviewDueAt(latestSourceAt: string | undefined, generatedAt: string, cadence: ActorFreshnessCadence): string {
  const base = Number.isFinite(Date.parse(latestSourceAt ?? "")) ? Date.parse(latestSourceAt ?? "") : Date.parse(generatedAt);
  const intervalDays = cadence === "daily" ? 1 : 7;
  return new Date(base + intervalDays * 86_400_000).toISOString();
}

function queryMatchesActor(query: string, actor: string): boolean {
  const normalizedQuery = query.toLowerCase();
  const names = new Set([actor.toLowerCase(), ...actorAliasesFor(actor).map((alias) => alias.toLowerCase())]);
  return [...names].some((name) => normalizedQuery === name || normalizedQuery.includes(name));
}

function idsWithHandoff(rows: HighPriorityActorFreshnessRowDto[], field: keyof HighPriorityActorFreshnessRowDto["handoffs"]): string[] {
  return rows.filter((row) => Boolean(row.handoffs[field])).map((row) => row.id);
}

function buildFieldScores(
  evidence: StagedEvidenceInput[],
  generatedAt: string,
  expectedMaxAgeDays: number,
  profileDates: Array<ReturnType<typeof buildActorQueryExtractionProfile>["temporal"]>
): TimelinessFieldScoreDto[] {
  return [
    fieldScore("recent_activity", latest(profileDates.flatMap((temporal) => [temporal.lastSeenAt, temporal.incidentDate, temporal.reportPublishedAt])), evidence, generatedAt, expectedMaxAgeDays, [
      evidence.length === 0 ? "no evidence available" : "",
      profileDates.every((temporal) => !temporal.lastSeenAt && !temporal.incidentDate && !temporal.reportPublishedAt) ? "no dated actor activity extracted" : ""
    ]),
    fieldScore("source_freshness", latest(evidence.map((item) => item.result.capture.publishedAt ?? item.result.capture.collectedAt)), evidence, generatedAt, expectedMaxAgeDays, []),
    fieldScore("victim_claims", latestForEntity(evidence, "victim"), evidenceWithEntity(evidence, "victim"), generatedAt, expectedMaxAgeDays, []),
    fieldScore("ttps", latestForEntity(evidence, "ttp"), evidenceWithEntity(evidence, "ttp"), generatedAt, expectedMaxAgeDays * 2, []),
    fieldScore("malware_tools", latestForEntity(evidence, "malware"), evidenceWithEntity(evidence, "malware"), generatedAt, expectedMaxAgeDays * 2, []),
    fieldScore("cves", latestForCves(evidence), evidence.filter((item) => item.result.indicators.some((indicator) => indicator.type === "cve") || item.result.entities.some((entity) => entity.type === "cve")), generatedAt, expectedMaxAgeDays * 2, []),
    fieldScore("infrastructure", latestForInfrastructure(evidence), evidence.filter((item) => item.result.indicators.some((indicator) => indicator.type !== "cve")), generatedAt, expectedMaxAgeDays, [])
  ];
}

function fieldScore(
  field: TimelinessFieldName,
  latestObservedAt: string | undefined,
  evidence: StagedEvidenceInput[],
  generatedAt: string,
  expectedMaxAgeDays: number,
  baseReasons: string[]
): TimelinessFieldScoreDto {
  const score = freshnessScore(latestObservedAt, generatedAt, expectedMaxAgeDays);
  const status = timelinessStatus(score, latestObservedAt);
  return {
    field,
    status,
    score,
    latestObservedAt,
    expectedMaxAgeDays,
    evidenceIds: evidence.map((item) => item.id).slice(0, 12),
    sourceIds: [...new Set(evidence.map((item) => item.result.capture.sourceId))].slice(0, 12),
    reasons: [
      ...baseReasons.filter(Boolean),
      ...(latestObservedAt ? [`latest ${field} observation is ${ageDays(latestObservedAt, generatedAt)} day(s) old`] : [`no ${field} timestamp available`]),
      ...(status === "stale" ? [`${field} exceeds ${expectedMaxAgeDays} day freshness expectation`] : [])
    ]
  };
}

function buildGaps(evidence: StagedEvidenceInput[], fields: TimelinessFieldScoreDto[], queryClass: TimelinessQueryClass): TimelinessGroundTruthHarnessDto["gaps"] {
  const gaps: TimelinessGroundTruthHarnessDto["gaps"] = [];
  const recent = fields.find((field) => field.field === "recent_activity");
  const source = fields.find((field) => field.field === "source_freshness");
  if (evidence.length === 0) gaps.push({ code: "no_evidence", message: "No evidence is available for timeliness evaluation.", evidenceIds: [] });
  if (recent?.status === "unknown") gaps.push({ code: "no_recent_activity", message: "No dated recent activity was extracted.", field: "recent_activity", evidenceIds: recent.evidenceIds });
  if (source?.status === "stale") gaps.push({ code: "stale_latest_source", message: "Latest source material is stale for this query class.", field: "source_freshness", evidenceIds: source.evidenceIds });
  for (const field of fields.filter((item) => item.status === "stale" && item.field !== "source_freshness")) {
    gaps.push({ code: "stale_field", message: `${field.field} is stale for this query class.`, field: field.field, evidenceIds: field.evidenceIds });
  }
  const latestSources = new Set((source?.sourceIds ?? []));
  if ((queryClass === "high_activity_actor" || queryClass === "cve") && latestSources.size === 1 && evidence.length > 1) {
    gaps.push({ code: "single_source_latest", message: "Latest activity depends on one source family.", field: "source_freshness", evidenceIds: source?.evidenceIds ?? [] });
  }
  if (evidence.length > 0 && evidence.every((item) => item.stage === "metadata_only_claim")) {
    gaps.push({ code: "metadata_only_latest", message: "Latest evidence is metadata-only and requires review before public ready wording.", evidenceIds: evidence.map((item) => item.id) });
  }
  return gaps;
}

function releaseCaveats(gaps: TimelinessGroundTruthHarnessDto["gaps"], fields: TimelinessFieldScoreDto[], queryClass: TimelinessQueryClass): string[] {
  return [
    ...(queryClass === "high_activity_actor" ? ["high-activity actor requires fresh dated evidence before latest-activity wording"] : []),
    ...gaps.map((gap) => gap.message),
    ...fields.filter((field) => field.status === "aging").map((field) => `${field.field} is aging; keep public answer caveated`)
  ].slice(0, 12);
}

function classifyQuery(query: string): TimelinessQueryClass {
  const normalized = query.toLowerCase();
  const aliases = new Set([normalized, ...actorAliasesFor(query).map((alias) => alias.toLowerCase())]);
  if (/\bCVE-\d{4}-\d{4,7}\b/i.test(query)) return "cve";
  if ([...aliases].some((alias) => HIGH_ACTIVITY_ACTORS.has(alias))) return "high_activity_actor";
  if ([...aliases].some((alias) => RANSOMWARE.has(alias))) return "ransomware";
  if (/\b(?:malware|tool|cobalt strike|snake|plugx|sliver)\b/i.test(query)) return "malware_tool";
  if (/[a-z]/i.test(query)) return "actor";
  return "unknown";
}

function maxAgeDaysFor(queryClass: TimelinessQueryClass): number {
  if (queryClass === "high_activity_actor") return 14;
  if (queryClass === "ransomware") return 7;
  if (queryClass === "cve") return 30;
  if (queryClass === "malware_tool") return 45;
  if (queryClass === "actor") return 60;
  return 90;
}

function latestForEntity(evidence: StagedEvidenceInput[], type: string): string | undefined {
  return latest(evidence
    .filter((item) => item.result.entities.some((entity) => entity.type === type))
    .map((item) => item.result.capture.publishedAt ?? item.result.capture.collectedAt));
}

function evidenceWithEntity(evidence: StagedEvidenceInput[], type: string): StagedEvidenceInput[] {
  return evidence.filter((item) => item.result.entities.some((entity) => entity.type === type));
}

function latestForCves(evidence: StagedEvidenceInput[]): string | undefined {
  return latest(evidence
    .filter((item) => item.result.indicators.some((indicator) => indicator.type === "cve") || item.result.entities.some((entity) => entity.type === "cve"))
    .map((item) => item.result.capture.publishedAt ?? item.result.capture.collectedAt));
}

function latestForInfrastructure(evidence: StagedEvidenceInput[]): string | undefined {
  return latest(evidence
    .filter((item) => item.result.indicators.some((indicator) => indicator.type !== "cve"))
    .map((item) => item.result.capture.publishedAt ?? item.result.capture.collectedAt));
}

function freshnessScore(value: string | undefined, generatedAt: string, maxAgeDays: number): number {
  if (!value) return 0;
  const days = ageDays(value, generatedAt);
  if (!Number.isFinite(days) || days < 0) return 0.5;
  if (days <= maxAgeDays) return 1;
  if (days <= maxAgeDays * 2) return 0.65;
  if (days <= maxAgeDays * 4) return 0.35;
  return 0.1;
}

function timelinessStatus(score: number, value: string | undefined): TimelinessStatus {
  if (!value) return "unknown";
  if (score >= 0.9) return "current";
  if (score >= 0.55) return "aging";
  return "stale";
}

function ageDays(value: string, generatedAt: string): number {
  const ageMs = Date.parse(generatedAt) - Date.parse(value);
  if (!Number.isFinite(ageMs)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round(ageMs / 86_400_000));
}

function latest(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}
