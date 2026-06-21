import type { ActorInput, EvidenceSourceFamily, HostedDefaultParserLiftContract, MarketplaceRow, PaidRowDecision, RemediationOwner, TiSearchResponse } from "./types.ts";
import { boolFromUnknown, clampInt, clampNumber, normalizeFacet, normalizeKey, numberFromUnknown, record, recordArray, round, safeIso, safePublicUrl, safeString, sourceType, stableHash, stringArray, topStrings, uniqueStrings, warningsFor } from "./utils.ts";

export function qualityFields(response: TiSearchResponse, observedAt: string, confidence: number, evidenceCount: number) {
  const sourceFamilies = new Set(response.sources.map((source) => sourceType(source.type)).filter(isEvidenceSourceFamily));
  const freshnessStatus = freshnessFor(observedAt);
  const normalizedConfidence = clampNumber(confidence, 0, 1);
  const evidenceGrade = evidenceCount >= 2
    ? "corroborated"
    : evidenceCount === 1
      ? "single_source"
      : "unverified";
  const missingSourceFamilies = expectedSourceFamilies(response).filter((family) => !sourceFamilies.has(family));
  const coverageStatus = coverageStatusFor(freshnessStatus, evidenceCount, sourceFamilies.size);
  const coverageGapCodes = coverageGapCodesFor(response, freshnessStatus, evidenceCount, sourceFamilies, missingSourceFamilies);
  const recommendedCollectionAction = recommendedCollectionActionFor(coverageGapCodes);

  return {
    sourceFamilyCount: sourceFamilies.size,
    sourceFamilies: [...sourceFamilies].sort(),
    missingSourceFamilies,
    coverageStatus,
    collectionPriority: collectionPriorityFor(coverageStatus, coverageGapCodes),
    recommendedCollectionAction,
    coverageGapCodes,
    freshnessStatus,
    evidenceGrade: evidenceGrade as MarketplaceRow["evidenceGrade"],
    isActionable: normalizedConfidence >= 0.6
      && evidenceCount > 0
      && (freshnessStatus === "current" || freshnessStatus === "recent"),
    reviewReasons: reviewReasonsFor(response, freshnessStatus, normalizedConfidence, evidenceCount),
    hasDarknetMetadata: response.sources.some((source) => sourceType(source.type) === "darknet_metadata"),
    hasPublicChannelCoverage: response.sources.some((source) => sourceType(source.type) === "public_channel")
  };
}

export function analysisFacetsFor(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  quality: ReturnType<typeof qualityFields>,
  context: {
    sourceType?: MarketplaceRow["sourceType"];
    claimType?: string;
    victimName?: string;
    affectedSectors?: string[];
    countries?: string[];
    attackId?: string;
    tactic?: string;
    coverageGapCode?: string;
  }
): string[] {
  return uniqueStrings([
    `row:${rowType}`,
    `status:${response.status ?? "unknown"}`,
    `freshness:${quality.freshnessStatus}`,
    `evidence:${quality.evidenceGrade}`,
    `coverage:${quality.coverageStatus}`,
    `priority:${quality.collectionPriority}`,
    `action:${quality.recommendedCollectionAction}`,
    context.sourceType ? `source:${context.sourceType}` : undefined,
    context.claimType ? `claim:${context.claimType}` : undefined,
    context.victimName ? "entity:victim" : undefined,
    context.affectedSectors?.length ? "entity:sector" : undefined,
    context.countries?.length ? "entity:country" : undefined,
    context.attackId ? "entity:attack_technique" : undefined,
    context.tactic ? `tactic:${normalizeFacet(context.tactic)}` : undefined,
    context.coverageGapCode ? `gap:${context.coverageGapCode}` : undefined,
    quality.hasPublicChannelCoverage ? "coverage:public_channel_present" : undefined,
    quality.hasDarknetMetadata ? "coverage:darknet_metadata_present" : undefined,
    "safety:metadata_only"
  ].filter((value): value is string => Boolean(value))).sort();
}

function expectedSourceFamilies(response: TiSearchResponse): EvidenceSourceFamily[] {
  const query = response.query.toLowerCase();
  const needsPublicChannel = /(lockbit|akira|clop|black basta|play|ransomhub|alphv|hunters|scattered spider|apt42|charming kitten|telegram|ransom)/i.test(query)
    || response.recentActivity.some((activity) => activity.claimType === "victim_claim");
  return needsPublicChannel ? ["clear_web", "public_channel"] : ["clear_web"];
}

function coverageStatusFor(
  freshnessStatus: MarketplaceRow["freshnessStatus"],
  evidenceCount: number,
  sourceFamilyCount: number
): MarketplaceRow["coverageStatus"] {
  if (evidenceCount === 0) return "no_evidence";
  if (freshnessStatus === "stale" || freshnessStatus === "unknown") return "stale";
  if (sourceFamilyCount < 2) return "thin";
  return "sufficient";
}

function coverageGapCodesFor(
  response: TiSearchResponse,
  freshnessStatus: MarketplaceRow["freshnessStatus"],
  evidenceCount: number,
  sourceFamilies: Set<EvidenceSourceFamily>,
  missingSourceFamilies: string[]
): string[] {
  const codes = new Set<string>();
  if (evidenceCount === 0) codes.add("no_public_evidence");
  if (freshnessStatus === "stale" || freshnessStatus === "unknown") codes.add("stale_or_missing_timestamp");
  if (missingSourceFamilies.includes("clear_web")) codes.add("missing_clear_web_evidence");
  if (missingSourceFamilies.includes("public_channel")) codes.add("missing_public_channel_evidence");
  if (sourceFamilies.size === 1 && evidenceCount > 0) codes.add("single_source_family");
  if (response.recentActivity.some((activity) => (activity.contradictingSourceIds?.length ?? 0) > 0)) codes.add("contradicting_public_reports");
  return [...codes].sort();
}

export function isEvidenceSourceFamily(value: string): value is EvidenceSourceFamily {
  return value === "clear_web" || value === "public_channel" || value === "darknet_metadata";
}

function recommendedCollectionActionFor(codes: string[]): MarketplaceRow["recommendedCollectionAction"] {
  if (codes.includes("contradicting_public_reports")) return "review_contradictions";
  if (codes.includes("missing_public_channel_evidence")) return "add_public_channel_sources";
  if (codes.includes("missing_clear_web_evidence") || codes.includes("no_public_evidence")) return "add_clear_web_sources";
  if (codes.includes("stale_or_missing_timestamp")) return "increase_polling";
  if (codes.includes("single_source_family")) return "monitor_public_channels";
  return "none";
}

function collectionPriorityFor(
  coverageStatus: MarketplaceRow["coverageStatus"],
  codes: string[]
): MarketplaceRow["collectionPriority"] {
  if (coverageStatus === "no_evidence" || codes.includes("contradicting_public_reports")) return "high";
  if (coverageStatus === "stale" || codes.includes("missing_public_channel_evidence")) return "medium";
  if (coverageStatus === "thin" || codes.includes("single_source_family")) return "low";
  return "none";
}

export function coverageGapTitle(code: string): string {
  switch (code) {
    case "no_public_evidence": return "No public evidence returned";
    case "stale_or_missing_timestamp": return "Freshness is stale or unknown";
    case "missing_clear_web_evidence": return "Clear-web evidence missing";
    case "missing_public_channel_evidence": return "Public-channel coverage missing";
    case "single_source_family": return "Only one source family supports this result";
    case "contradicting_public_reports": return "Contradicting public reports need review";
    default: return "Coverage gap";
  }
}

export function coverageGapSummary(response: TiSearchResponse, code: string, quality: ReturnType<typeof qualityFields>): string {
  const families = quality.sourceFamilies.length ? quality.sourceFamilies.join(", ") : "none";
  const missing = quality.missingSourceFamilies.length ? quality.missingSourceFamilies.join(", ") : "none";
  return `${coverageGapTitle(code)} for ${response.query}. Current families: ${families}. Missing families: ${missing}. Recommended action: ${quality.recommendedCollectionAction}.`;
}

function reviewReasonsFor(
  response: TiSearchResponse,
  freshnessStatus: MarketplaceRow["freshnessStatus"],
  confidence: number,
  evidenceCount: number
): string[] {
  const reasons = new Set<string>();
  if (response.status && response.status !== "ready") reasons.add(`status:${response.status}`);
  if (freshnessStatus === "current" || freshnessStatus === "recent") reasons.add(`freshness:${freshnessStatus}`);
  if (freshnessStatus === "stale" || freshnessStatus === "unknown") reasons.add(`hold:${freshnessStatus}_evidence`);
  if (evidenceCount >= 2) reasons.add("evidence:corroborated");
  if (evidenceCount === 1) reasons.add("review:single_source");
  if (evidenceCount === 0) reasons.add("hold:no_public_evidence");
  if (confidence < 0.35) reasons.add("hold:low_confidence");
  if (confidence >= 0.6 && evidenceCount > 0 && freshnessStatus !== "stale" && freshnessStatus !== "unknown") reasons.add("actionable:monitor_or_triage");
  if (response.sources.some((source) => sourceType(source.type) === "darknet_metadata")) reasons.add("caveat:darknet_metadata_only");
  if (response.sources.some((source) => sourceType(source.type) === "public_channel")) reasons.add("caveat:public_channel_requires_corroboration");
  if (response.recentActivity.some((item) => (item.contradictingSourceIds?.length ?? 0) > 0)) reasons.add("hold:contradictory_reporting");
  if (response.notes.some((note) => note.toLowerCase().includes("review"))) reasons.add("review:analyst_review_required");
  return [...reasons].slice(0, 12);
}

export function freshnessFor(value: string): MarketplaceRow["freshnessStatus"] {
  const observed = Date.parse(value);
  if (Number.isNaN(observed)) return "unknown";
  const ageDays = (Date.now() - observed) / 86_400_000;
  if (ageDays < -1) return "unknown";
  if (ageDays <= 7) return "current";
  if (ageDays <= 90) return "recent";
  return "stale";
}
