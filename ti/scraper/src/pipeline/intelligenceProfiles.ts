import type { ExtractedEntity, Indicator, PipelineResult } from "../types.ts";
import { clampScore } from "../utils.ts";
import { ACTOR_ALIAS_RECORDS, actorAliasesFor } from "./actorAliases.ts";
import { EXTRACTOR_VERSION } from "./extractors.ts";

export type ExtractionProfileKind =
  | "actor_intelligence"
  | "ransomware_victim_intelligence"
  | "vulnerability_exploitation"
  | "malware_tooling"
  | "infrastructure_ioc"
  | "attack_ttp";

export type EvidenceStage =
  | "seeded"
  | "live_discovery"
  | "captured_page"
  | "public_channel_message"
  | "metadata_only_claim"
  | "extracted_relationship"
  | "reviewed_promoted";

export type EvidenceChangeKind = "added" | "promoted" | "downgraded" | "blocked";

export type TiConfidenceCaveatCode =
  | "direct_attribution"
  | "vendor_reported_attribution"
  | "unverified_claim"
  | "live_snippet_only"
  | "public_channel_mention"
  | "metadata_only_leak_claim"
  | "historical_context"
  | "contradicted"
  | "stale"
  | "needs_review";

export interface GroundingReference {
  kind: "sentence" | "section" | "snippet";
  text: string;
  sourceId: string;
  captureId?: string;
  url?: string;
  startOffset?: number;
  endOffset?: number;
  evidenceStage: EvidenceStage;
}

export interface TiConfidenceCaveat {
  code: TiConfidenceCaveatCode;
  label: string;
  severity: "info" | "warning" | "critical";
  reason: string;
  grounding: GroundingReference[];
}

export type AttributionSignal =
  | "direct_attribution"
  | "suspected_attribution"
  | "historical_background"
  | "vendor_disagreement"
  | "weak_co_mention"
  | "machine_translation_uncertainty"
  | "extracted_not_actionable";

export interface TemporalExtraction {
  reportPublishedAt?: string;
  incidentDate?: string;
  campaignWindow?: { start?: string; end?: string };
  firstSeenAt?: string;
  lastSeenAt?: string;
  claimedLeakDate?: string;
  observedInfrastructureDate?: string;
  freshnessScore: number;
  notes: string[];
}

export interface ActorQueryExtractionProfile {
  kind: ExtractionProfileKind;
  query: string;
  canonicalActor?: string;
  aliases: string[];
  actorMentions: ExtractedEntity[];
  targetSectors: ExtractedEntity[];
  targetRegions: ExtractedEntity[];
  victimOrganizations: ExtractedEntity[];
  malwareAndTooling: ExtractedEntity[];
  cves: Array<ExtractedEntity | Indicator>;
  infrastructureIndicators: Indicator[];
  attackTechniques: ExtractedEntity[];
  campaignNames: string[];
  temporal: TemporalExtraction;
  attribution: {
    signal: AttributionSignal;
    confidence: number;
    reasons: string[];
  };
  confidence: number;
  notes: string[];
}

export interface TiSearchResultDto {
  query: string;
  extractorVersion: string;
  evidenceStage: EvidenceStage;
  isPartial: boolean;
  isPromoted: boolean;
  firstSeen: string;
  lastUpdated: string;
  needsAnalystReview: boolean;
  summaryBullets: string[];
  recentActivity: TemporalExtraction;
  targets: {
    sectors: string[];
    regions: string[];
    victims: string[];
  };
  ttps: string[];
  datasets: {
    coverage: string[];
    sourceCount: number;
    indicatorCount: number;
    entityCount: number;
  };
  sources: Array<{ sourceId: string; captureId?: string; url?: string; collectedAt?: string }>;
  confidence: number;
  caveats: TiConfidenceCaveat[];
  confidenceCaveats: string[];
  sourceCoverageGaps: string[];
  evidenceDeltas?: EvidenceDeltaSummary;
  notes: string[];
}

export interface StagedEvidenceInput {
  id: string;
  stage: EvidenceStage;
  result: PipelineResult;
  observedAt: string;
  previousStage?: EvidenceStage;
  previousConfidence?: number;
  blockedReason?: string;
}

export interface EvidenceDeltaSummary {
  added: number;
  promoted: number;
  downgraded: number;
  blocked: number;
  changes: Array<{
    evidenceId: string;
    changeKind: EvidenceChangeKind;
    evidenceStage: EvidenceStage;
    confidenceBefore?: number;
    confidenceAfter: number;
    sourceIds: string[];
    firstSeen: string;
    lastUpdated: string;
    needsAnalystReview: boolean;
  }>;
}

const DIRECT_ATTRIBUTION_RE = /\b(?:attributed to|attributed .* to|linked to|linked .* to|tracked as|also known as|aka|used by|operated by)\b/i;
const SUSPECTED_ATTRIBUTION_RE = /\b(?:suspected|likely|possibly|may be|assessed|uncertain|unconfirmed)\b/i;
const HISTORICAL_RE = /\b(?:historically|previously|since \d{4}|background|known for)\b/i;
const DISAGREEMENT_RE = /\b(?:disputed|vendor disagreement|conflicting reports|different vendors)\b/i;
const TRANSLATION_RE = /\b(?:translated|machine translated|translation)\b/i;
const CAMPAIGN_RE = /\b(?:campaign|operation|activity cluster)\s+(?:called|named|tracked as)?\s*["']?([A-Z][A-Za-z0-9 -]{2,60})["']?/g;

export function buildActorQueryExtractionProfile(query: string, result: PipelineResult): ActorQueryExtractionProfile {
  const canonicalActor = canonicalActorForQuery(query, result.entities);
  const actorMentions = result.entities.filter((entity) => entity.type === "actor");
  const targetSectors = result.entities.filter((entity) => entity.type === "sector");
  const targetRegions = result.entities.filter((entity) => entity.type === "country");
  const victimOrganizations = result.entities.filter((entity) => entity.type === "victim");
  const malwareAndTooling = result.entities.filter((entity) => entity.type === "malware" || entity.type === "ransomware_family");
  const cveEntities = result.entities.filter((entity) => entity.type === "cve");
  const cveIndicators = result.indicators.filter((indicator) => indicator.type === "cve");
  const infrastructureIndicators = result.indicators.filter((indicator) => indicator.type !== "cve");
  const attackTechniques = result.entities.filter((entity) => entity.type === "ttp" && (entity.provenance?.length ?? 0) > 0);
  const temporal = extractTemporal(result);
  const attribution = classifyAttribution(result, canonicalActor);
  const coverage = [
    actorMentions.length ? "actors" : undefined,
    victimOrganizations.length ? "victims" : undefined,
    targetSectors.length ? "sectors" : undefined,
    targetRegions.length ? "regions" : undefined,
    malwareAndTooling.length ? "malware-tooling" : undefined,
    cveEntities.length || cveIndicators.length ? "vulnerabilities" : undefined,
    infrastructureIndicators.length ? "infrastructure" : undefined,
    attackTechniques.length ? "ttps" : undefined,
    temporal.reportPublishedAt || temporal.incidentDate ? "temporal" : undefined
  ].filter(Boolean) as string[];

  return {
    kind: "actor_intelligence",
    query,
    canonicalActor,
    aliases: canonicalActor ? actorAliasesFor(canonicalActor) : [],
    actorMentions,
    targetSectors,
    targetRegions,
    victimOrganizations,
    malwareAndTooling,
    cves: [...cveEntities, ...cveIndicators],
    infrastructureIndicators,
    attackTechniques,
    campaignNames: extractCampaignNames(result.capture.body ?? result.incident?.summary ?? ""),
    temporal,
    attribution,
    confidence: clampScore((result.incident?.confidence ?? 0.2) * 0.55 + attribution.confidence * 0.35 + temporal.freshnessScore * 0.1),
    notes: [
      ...attribution.reasons,
      ...(attackTechniques.length ? [] : ["no grounded ATT&CK/TTP evidence extracted"]),
      ...(temporal.notes.length ? temporal.notes : [])
    ],
  };
}

export function buildTiSearchResultDto(query: string, result: PipelineResult): TiSearchResultDto {
  const profile = buildActorQueryExtractionProfile(query, result);
  const evidenceStage = evidenceStageForResult(result);
  const confidence = stagedConfidence(profile.confidence, evidenceStage, profile.attribution.signal);
  const firstSeen = profile.temporal.firstSeenAt ?? result.capture.publishedAt ?? result.capture.collectedAt;
  const lastUpdated = profile.temporal.lastSeenAt ?? result.capture.collectedAt;
  const needsAnalystReview = needsReview(profile, evidenceStage);
  const caveats = buildConfidenceCaveats(profile, result, evidenceStage, needsAnalystReview);
  return {
    query,
    extractorVersion: EXTRACTOR_VERSION,
    evidenceStage,
    isPartial: isPartialEvidence(evidenceStage),
    isPromoted: evidenceStage === "reviewed_promoted",
    firstSeen,
    lastUpdated,
    needsAnalystReview,
    summaryBullets: summaryBullets(profile),
    recentActivity: profile.temporal,
    targets: {
      sectors: uniqueValues(profile.targetSectors),
      regions: uniqueValues(profile.targetRegions),
      victims: uniqueValues(profile.victimOrganizations)
    },
    ttps: uniqueValues(profile.attackTechniques),
    datasets: {
      coverage: [
        ...(profile.actorMentions.length ? ["actor-profile"] : []),
        ...(profile.victimOrganizations.length ? ["victim-observations"] : []),
        ...(profile.malwareAndTooling.length ? ["malware-tool-observations"] : []),
        ...(profile.cves.length ? ["vulnerability-observations"] : []),
        ...(profile.infrastructureIndicators.length ? ["ioc-observations"] : []),
        ...(profile.attackTechniques.length ? ["grounded-ttp-observations"] : []),
        ...(profile.temporal.reportPublishedAt || profile.temporal.incidentDate ? ["temporal-observations"] : [])
      ],
      sourceCount: result.capture.sourceId ? 1 : 0,
      indicatorCount: result.indicators.length,
      entityCount: result.entities.length
    },
    sources: [{
      sourceId: result.capture.sourceId,
      captureId: result.capture.id,
      url: result.capture.url,
      collectedAt: result.capture.collectedAt
    }],
    confidence,
    caveats,
    confidenceCaveats: caveats.map((caveat) => caveat.reason),
    sourceCoverageGaps: sourceCoverageGaps(profile),
    notes: profile.notes
  };
}

export function buildLiveTiSearchSummary(query: string, evidence: StagedEvidenceInput[]): TiSearchResultDto {
  const ranked = [...evidence].sort((left, right) => rankEvidence(right) - rankEvidence(left));
  const primary = ranked[0];
  if (!primary) throw new Error("Cannot build live search summary without evidence.");
  const base = buildTiSearchResultDto(query, primary.result);
  const deltas = summarizeEvidenceDeltas(evidence);
  const dtos = ranked.map((item) => buildTiSearchResultDto(query, item.result));
  const mergedVictims = mergeStrings(dtos.flatMap((dto) => dto.targets.victims));
  const mergedSectors = mergeStrings(dtos.flatMap((dto) => dto.targets.sectors));
  const mergedRegions = mergeStrings(dtos.flatMap((dto) => dto.targets.regions));
  const mergedTtps = mergeStrings(dtos.flatMap((dto) => dto.ttps));
  const coverage = mergeStrings(dtos.flatMap((dto) => dto.datasets.coverage));
  const notes = mergeStrings([
    ...dtos.flatMap((dto) => dto.notes),
    ...dtos.flatMap((dto) => dto.confidenceCaveats),
    ...dtos.flatMap((dto) => dto.sourceCoverageGaps)
  ]);

  return {
    ...base,
    evidenceStage: primary.stage,
    isPartial: dtos.some((dto) => dto.isPartial),
    isPromoted: dtos.some((dto) => dto.isPromoted),
    firstSeen: earliest(dtos.map((dto) => dto.firstSeen)) ?? base.firstSeen,
    lastUpdated: latest(dtos.map((dto) => dto.lastUpdated)) ?? base.lastUpdated,
    needsAnalystReview: dtos.some((dto) => dto.needsAnalystReview),
    summaryBullets: liveSummaryBullets(query, dtos, deltas),
    targets: {
      victims: mergedVictims,
      sectors: mergedSectors,
      regions: mergedRegions
    },
    ttps: mergedTtps,
    datasets: {
      coverage,
      sourceCount: new Set(evidence.map((item) => item.result.capture.sourceId)).size,
      indicatorCount: sum(dtos.map((dto) => dto.datasets.indicatorCount)),
      entityCount: sum(dtos.map((dto) => dto.datasets.entityCount))
    },
    sources: ranked.map((item) => ({
      sourceId: item.result.capture.sourceId,
      captureId: item.result.capture.id,
      url: item.result.capture.url,
      collectedAt: item.result.capture.collectedAt
    })),
    confidence: clampScore(sum(dtos.map((dto) => dto.confidence * rankEvidence(evidence[dtos.indexOf(dto)]))) / Math.max(1, sum(evidence.map(rankEvidence)))),
    caveats: mergeCaveats(dtos.flatMap((dto) => dto.caveats)),
    confidenceCaveats: mergeStrings(dtos.flatMap((dto) => dto.confidenceCaveats)),
    sourceCoverageGaps: mergeStrings(dtos.flatMap((dto) => dto.sourceCoverageGaps)),
    evidenceDeltas: deltas,
    notes
  };
}

export function summarizeEvidenceDeltas(evidence: StagedEvidenceInput[]): EvidenceDeltaSummary {
  const changes = evidence.map((item) => {
    const after = stagedConfidence(buildActorQueryExtractionProfile(item.id, item.result).confidence, item.stage, "weak_co_mention");
    const before = item.previousConfidence;
    const changeKind: EvidenceChangeKind = item.blockedReason
      ? "blocked"
      : item.previousStage && stageRank(item.stage) > stageRank(item.previousStage)
        ? "promoted"
        : before !== undefined && after < before
          ? "downgraded"
          : "added";
    return {
      evidenceId: item.id,
      changeKind,
      evidenceStage: item.stage,
      confidenceBefore: before,
      confidenceAfter: after,
      sourceIds: [item.result.capture.sourceId],
      firstSeen: item.result.capture.publishedAt ?? item.result.capture.collectedAt,
      lastUpdated: item.observedAt,
      needsAnalystReview: item.blockedReason !== undefined || isPartialEvidence(item.stage) || after < 0.65
    };
  }).sort((left, right) => changeRank(right.changeKind) - changeRank(left.changeKind) || right.confidenceAfter - left.confidenceAfter);

  return {
    added: changes.filter((change) => change.changeKind === "added").length,
    promoted: changes.filter((change) => change.changeKind === "promoted").length,
    downgraded: changes.filter((change) => change.changeKind === "downgraded").length,
    blocked: changes.filter((change) => change.changeKind === "blocked").length,
    changes
  };
}

export function extractionProfileKinds(): ExtractionProfileKind[] {
  return [
    "actor_intelligence",
    "ransomware_victim_intelligence",
    "vulnerability_exploitation",
    "malware_tooling",
    "infrastructure_ioc",
    "attack_ttp"
  ];
}

function canonicalActorForQuery(query: string, entities: ExtractedEntity[]): string | undefined {
  const normalizedQuery = query.toLowerCase();
  const fromAlias = ACTOR_ALIAS_RECORDS.find((record) => record.aliases.some((alias) => normalizedQuery.includes(alias)));
  if (fromAlias) return fromAlias.canonical;
  return entities.find((entity) => entity.type === "actor")?.value;
}

function classifyAttribution(result: PipelineResult, canonicalActor?: string): ActorQueryExtractionProfile["attribution"] {
  const text = `${result.capture.body ?? ""} ${result.incident?.summary ?? ""}`;
  if (DISAGREEMENT_RE.test(text)) {
    return { signal: "vendor_disagreement", confidence: 0.42, reasons: ["vendor disagreement or conflicting reports mentioned"] };
  }
  if (TRANSLATION_RE.test(text)) {
    return { signal: "machine_translation_uncertainty", confidence: 0.48, reasons: ["translation uncertainty mentioned"] };
  }
  if (canonicalActor && DIRECT_ATTRIBUTION_RE.test(text)) {
    return { signal: "direct_attribution", confidence: 0.82, reasons: [`direct attribution language found for ${canonicalActor}`] };
  }
  if (SUSPECTED_ATTRIBUTION_RE.test(text)) {
    return { signal: "suspected_attribution", confidence: 0.58, reasons: ["suspected or uncertain attribution language found"] };
  }
  if (HISTORICAL_RE.test(text)) {
    return { signal: "historical_background", confidence: 0.46, reasons: ["historical background language found"] };
  }
  if (canonicalActor) {
    return { signal: "weak_co_mention", confidence: 0.5, reasons: ["actor was co-mentioned without direct attribution language"] };
  }
  return { signal: "extracted_not_actionable", confidence: 0.32, reasons: ["no actionable actor attribution signal extracted"] };
}

function evidenceStageForResult(result: PipelineResult): EvidenceStage {
  const explicit = result.capture.metadata.evidenceStage;
  if (isEvidenceStage(explicit)) return explicit;
  if (result.capture.storageKind === "metadata_only") return "metadata_only_claim";
  if (result.capture.metadata.adapter === "telegram_public") return "public_channel_message";
  if (result.capture.body) return "captured_page";
  return "live_discovery";
}

function extractTemporal(result: PipelineResult): TemporalExtraction {
  const text = `${result.capture.body ?? ""} ${result.incident?.summary ?? ""}`;
  const dates = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+20\d{2})\b/gi)]
    .map((match) => normalizeDate(match[1]))
    .filter((date): date is string => Boolean(date));
  const firstSeenAt = labeledDate(text, /first seen(?: on| in)?\s+/i);
  const lastSeenAt = labeledDate(text, /last seen(?: on| in)?\s+/i);
  const incidentDate = labeledDate(text, /(?:incident date|observed on|activity on)\s+/i);
  const claimedLeakDate = labeledDate(text, /(?:claimed leak date|leak date|posted on)\s+/i);
  const observedInfrastructureDate = labeledDate(text, /(?:infrastructure (?:observed|seen) on|observed infrastructure on)\s+/i);
  const campaignStart = labeledDate(text, /(?:campaign window|campaign from|between)\s+/i);
  const campaignEnd = labeledDate(text, /\b(?:through|to|and)\s+/i);
  const reportPublishedAt = result.capture.publishedAt ?? firstIsoDate(result.capture.metadata.publishedAt) ?? firstIsoDate(result.capture.collectedAt);
  const anchor = lastSeenAt ?? incidentDate ?? claimedLeakDate ?? dates[0] ?? reportPublishedAt;

  return {
    reportPublishedAt,
    incidentDate,
    campaignWindow: { start: campaignStart, end: campaignEnd },
    firstSeenAt,
    lastSeenAt,
    claimedLeakDate,
    observedInfrastructureDate,
    freshnessScore: freshnessScore(anchor, result.capture.collectedAt),
    notes: [
      ...(dates.length === 0 ? ["no explicit dates found in source text"] : []),
      ...(!incidentDate && !firstSeenAt && !lastSeenAt ? ["temporal extraction is based on publication/collection date only"] : [])
    ]
  };
}

function labeledDate(text: string, label: RegExp): string | undefined {
  const start = label.exec(text);
  if (!start) return undefined;
  const slice = text.slice(start.index + start[0].length, start.index + start[0].length + 48);
  const date = /\b(20\d{2}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+20\d{2})\b/i.exec(slice)?.[1];
  return date ? normalizeDate(date) : undefined;
}

function normalizeDate(value: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function firstIsoDate(value: unknown): string | undefined {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}

function freshnessScore(anchor: string | undefined, collectedAt: string): number {
  if (!anchor || Number.isNaN(Date.parse(anchor)) || Number.isNaN(Date.parse(collectedAt))) return 0.25;
  const ageDays = Math.max(0, (Date.parse(collectedAt) - Date.parse(anchor)) / 86_400_000);
  if (ageDays <= 7) return 0.95;
  if (ageDays <= 30) return 0.75;
  if (ageDays <= 180) return 0.5;
  return 0.25;
}

function extractCampaignNames(text: string): string[] {
  return [...text.matchAll(CAMPAIGN_RE)].map((match) => match[1].trim()).filter(Boolean);
}

function uniqueValues(entities: ExtractedEntity[]): string[] {
  return [...new Set(entities.map((entity) => entity.value))];
}

function stagedConfidence(confidence: number, stage: EvidenceStage, signal: AttributionSignal): number {
  const stageMultiplier: Record<EvidenceStage, number> = {
    seeded: 0.64,
    live_discovery: 0.45,
    captured_page: 0.86,
    public_channel_message: 0.58,
    metadata_only_claim: 0.52,
    extracted_relationship: 0.9,
    reviewed_promoted: 1
  };
  const falsePositivePenalty = signal === "historical_background" || signal === "weak_co_mention" || signal === "extracted_not_actionable" ? 0.18 : 0;
  return clampScore(confidence * stageMultiplier[stage] - falsePositivePenalty);
}

function isPartialEvidence(stage: EvidenceStage): boolean {
  return stage === "seeded" || stage === "live_discovery" || stage === "public_channel_message" || stage === "metadata_only_claim";
}

function needsReview(profile: ActorQueryExtractionProfile, stage: EvidenceStage): boolean {
  return isPartialEvidence(stage)
    || profile.confidence < 0.65
    || profile.attribution.signal !== "direct_attribution"
    || profile.notes.some((note) => /uncertain|disagreement|translation|no grounded/i.test(note));
}

function confidenceCaveats(profile: ActorQueryExtractionProfile, stage: EvidenceStage): string[] {
  return [
    ...(isPartialEvidence(stage) ? [`${stage} evidence is partial and should not be promoted without corroboration`] : []),
    ...(profile.attribution.signal === "historical_background" ? ["historical mention suppressed as weak live-search evidence"] : []),
    ...(profile.attribution.signal === "weak_co_mention" ? ["actor co-mention lacks direct attribution language"] : []),
    ...(profile.attribution.signal === "vendor_disagreement" ? ["vendor disagreement lowers confidence"] : []),
    ...(profile.attribution.signal === "machine_translation_uncertainty" ? ["machine translation uncertainty lowers confidence"] : [])
  ];
}

function buildConfidenceCaveats(
  profile: ActorQueryExtractionProfile,
  result: PipelineResult,
  stage: EvidenceStage,
  needsAnalystReview: boolean
): TiConfidenceCaveat[] {
  const grounding = groundingFor(result, stage);
  const caveats: TiConfidenceCaveat[] = [];
  if (profile.attribution.signal === "direct_attribution") {
    caveats.push(caveat("direct_attribution", "Direct attribution", "info", "direct attribution language was extracted from grounded evidence", grounding));
  }
  if (/\b(?:reported by|according to|researchers|vendor|microsoft|mandiant|crowdstrike|recorded future)\b/i.test(result.capture.body ?? result.incident?.summary ?? "")) {
    caveats.push(caveat("vendor_reported_attribution", "Vendor-reported attribution", "info", "attribution appears to come from a named reporting source", grounding));
  }
  if (profile.attribution.signal === "suspected_attribution") {
    caveats.push(caveat("unverified_claim", "Unverified claim", "warning", "source text uses suspected or uncertain attribution language", grounding));
  }
  if (stage === "live_discovery") {
    caveats.push(caveat("live_snippet_only", "Live snippet only", "warning", "live discovery snippets are partial until captured and extracted", grounding));
  }
  if (stage === "public_channel_message") {
    caveats.push(caveat("public_channel_mention", "Public-channel mention", "warning", "public-channel mentions need corroboration before promotion", grounding));
  }
  if (stage === "metadata_only_claim") {
    caveats.push(caveat("metadata_only_leak_claim", "Metadata-only leak claim", "critical", "metadata-only claims cannot support high-confidence assertions alone", grounding));
  }
  if (profile.attribution.signal === "historical_background") {
    caveats.push(caveat("historical_context", "Historical context", "warning", "historical/background actor mentions are suppressed as weak current evidence", grounding));
  }
  if (profile.attribution.signal === "vendor_disagreement") {
    caveats.push(caveat("contradicted", "Contradicted or contested", "critical", "source text indicates conflicting or disputed attribution", grounding));
  }
  if (profile.temporal.freshnessScore <= 0.25) {
    caveats.push(caveat("stale", "Stale evidence", "warning", "evidence appears stale relative to collection time", grounding));
  }
  if (needsAnalystReview) {
    caveats.push(caveat("needs_review", "Needs analyst review", "warning", "confidence, stage, or caveats require analyst review before promotion", grounding));
  }
  return dedupeCaveats(caveats);
}

function caveat(
  code: TiConfidenceCaveatCode,
  label: string,
  severity: TiConfidenceCaveat["severity"],
  reason: string,
  grounding: GroundingReference[]
): TiConfidenceCaveat {
  return { code, label, severity, reason, grounding };
}

function groundingFor(result: PipelineResult, stage: EvidenceStage): GroundingReference[] {
  const entityGrounding = result.entities.flatMap((entity) => entity.provenance ?? []);
  const indicatorGrounding = result.indicators.flatMap((indicator) => indicator.provenance ?? []);
  const provenances = [...entityGrounding, ...indicatorGrounding].slice(0, 8);
  if (provenances.length > 0) {
    return provenances.map((provenance) => ({
      kind: stage === "live_discovery" ? "snippet" : "sentence",
      text: provenance.evidenceText ?? "",
      sourceId: provenance.sourceId,
      captureId: provenance.captureId,
      url: provenance.url,
      startOffset: provenance.startOffset,
      endOffset: provenance.endOffset,
      evidenceStage: stage
    }));
  }
  const body = result.capture.body ?? result.incident?.summary ?? "";
  return [{
    kind: stage === "live_discovery" || stage === "metadata_only_claim" ? "snippet" : "section",
    text: body.slice(0, 280),
    sourceId: result.capture.sourceId,
    captureId: result.capture.id,
    url: result.capture.url,
    evidenceStage: stage
  }];
}

function dedupeCaveats(caveats: TiConfidenceCaveat[]): TiConfidenceCaveat[] {
  const seen = new Set<string>();
  return caveats.filter((item) => {
    if (seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });
}

function mergeCaveats(caveats: TiConfidenceCaveat[]): TiConfidenceCaveat[] {
  const byCode = new Map<TiConfidenceCaveatCode, TiConfidenceCaveat>();
  for (const item of caveats) {
    const existing = byCode.get(item.code);
    if (!existing) {
      byCode.set(item.code, item);
      continue;
    }
    byCode.set(item.code, {
      ...existing,
      grounding: [...existing.grounding, ...item.grounding].slice(0, 12)
    });
  }
  return [...byCode.values()];
}

function sourceCoverageGaps(profile: ActorQueryExtractionProfile): string[] {
  return [
    ...(profile.actorMentions.length ? [] : ["no actor entity extracted"]),
    ...(profile.victimOrganizations.length ? [] : ["no victim organization extracted"]),
    ...(profile.infrastructureIndicators.length ? [] : ["no infrastructure indicators extracted"]),
    ...(profile.attackTechniques.length ? [] : ["no grounded TTP extracted"])
  ];
}

function rankEvidence(evidence: StagedEvidenceInput): number {
  const profile = buildActorQueryExtractionProfile(evidence.id, evidence.result);
  return stageRank(evidence.stage) + stagedConfidence(profile.confidence, evidence.stage, profile.attribution.signal);
}

function stageRank(stage: EvidenceStage): number {
  return {
    seeded: 1,
    live_discovery: 2,
    public_channel_message: 3,
    metadata_only_claim: 3,
    captured_page: 4,
    extracted_relationship: 5,
    reviewed_promoted: 6
  }[stage];
}

function changeRank(change: EvidenceChangeKind): number {
  return { promoted: 4, added: 3, downgraded: 2, blocked: 1 }[change];
}

function isEvidenceStage(value: unknown): value is EvidenceStage {
  return typeof value === "string" && [
    "seeded",
    "live_discovery",
    "captured_page",
    "public_channel_message",
    "metadata_only_claim",
    "extracted_relationship",
    "reviewed_promoted"
  ].includes(value);
}

function mergeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function earliest(values: string[]): string | undefined {
  return values.filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
}

function latest(values: string[]): string | undefined {
  return values.filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function liveSummaryBullets(query: string, dtos: TiSearchResultDto[], deltas: EvidenceDeltaSummary): string[] {
  const victims = mergeStrings(dtos.flatMap((dto) => dto.targets.victims));
  const ttps = mergeStrings(dtos.flatMap((dto) => dto.ttps));
  const indicatorCount = sum(dtos.map((dto) => dto.datasets.indicatorCount));
  return [
    `${query} has ${dtos.length} staged evidence items (${deltas.added} added, ${deltas.promoted} promoted, ${deltas.downgraded} downgraded, ${deltas.blocked} blocked).`,
    ...(victims.length ? [`Current target observations include ${victims.slice(0, 4).join(", ")}.`] : []),
    ...(ttps.length ? [`Grounded TTP observations include ${ttps.slice(0, 4).join(", ")}.`] : []),
    ...(indicatorCount > 0 ? [`Extracted indicator observations include ${indicatorCount} IOC values.`] : []),
    ...mergeStrings(dtos.flatMap((dto) => dto.confidenceCaveats)).slice(0, 2)
  ];
}

function summaryBullets(profile: ActorQueryExtractionProfile): string[] {
  const bullets = [];
  if (profile.canonicalActor) bullets.push(`${profile.canonicalActor} matched via ${profile.aliases.length} deterministic aliases.`);
  if (profile.victimOrganizations.length || profile.targetSectors.length) {
    bullets.push(`Targets include ${[...uniqueValues(profile.victimOrganizations), ...uniqueValues(profile.targetSectors)].slice(0, 4).join(", ")}.`);
  }
  if (profile.attackTechniques.length) bullets.push(`Grounded TTP hints include ${uniqueValues(profile.attackTechniques).join(", ")}.`);
  if (profile.infrastructureIndicators.length) bullets.push(`${profile.infrastructureIndicators.length} infrastructure/IOC values extracted with provenance.`);
  bullets.push(`Attribution signal: ${profile.attribution.signal} (${Math.round(profile.attribution.confidence * 100)}%).`);
  return bullets;
}
