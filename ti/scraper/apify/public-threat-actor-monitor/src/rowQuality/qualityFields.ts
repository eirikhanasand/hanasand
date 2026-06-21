import type { EvidenceSourceFamily, MarketplaceRow, TiSearchResponse } from "../types.ts";
import { clampNumber, sourceType } from "../utils.ts";
import { coverageGapCodesFor, coverageStatusFor, expectedSourceFamilies } from "./rules.ts";
import { reviewReasonsFor } from "./reviewReasons.ts";

export function qualityFields(response: TiSearchResponse, observedAt: string, confidence: number, evidenceCount: number) {
  const sourceFamilies = new Set(response.sources.map((source) => sourceType(source.type)).filter(isEvidenceSourceFamily));
  const freshnessStatus = freshnessFor(observedAt);
  const normalizedConfidence = clampNumber(confidence, 0, 1);
  const evidenceGrade = evidenceGradeFor(evidenceCount);
  const missingSourceFamilies = expectedSourceFamilies(response).filter((family) => !sourceFamilies.has(family));
  const coverageStatus = coverageStatusFor(freshnessStatus, evidenceCount, sourceFamilies.size);
  const coverageGapCodes = coverageGapCodesFor(response, freshnessStatus, evidenceCount, sourceFamilies, missingSourceFamilies);

  return {
    sourceFamilyCount: sourceFamilies.size,
    sourceFamilies: [...sourceFamilies].sort(),
    missingSourceFamilies,
    coverageStatus,
    collectionPriority: collectionPriorityFor(coverageStatus, coverageGapCodes),
    recommendedCollectionAction: recommendedCollectionActionFor(coverageGapCodes),
    coverageGapCodes,
    freshnessStatus,
    evidenceGrade: evidenceGrade as MarketplaceRow["evidenceGrade"],
    isActionable: isActionable(normalizedConfidence, evidenceCount, freshnessStatus),
    reviewReasons: reviewReasonsFor(response, freshnessStatus, normalizedConfidence, evidenceCount),
    hasDarknetMetadata: response.sources.some((source) => sourceType(source.type) === "darknet_metadata"),
    hasPublicChannelCoverage: response.sources.some((source) => sourceType(source.type) === "public_channel")
  };
}

export function isEvidenceSourceFamily(value: string): value is EvidenceSourceFamily {
  return value === "clear_web" || value === "public_channel" || value === "darknet_metadata";
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

function recommendedCollectionActionFor(codes: string[]): MarketplaceRow["recommendedCollectionAction"] {
  if (codes.includes("contradicting_public_reports")) return "review_contradictions";
  if (codes.includes("missing_public_channel_evidence")) return "add_public_channel_sources";
  if (codes.includes("missing_clear_web_evidence") || codes.includes("no_public_evidence")) return "add_clear_web_sources";
  if (codes.includes("stale_or_missing_timestamp")) return "increase_polling";
  if (codes.includes("single_source_family")) return "monitor_public_channels";
  return "none";
}
function collectionPriorityFor(coverageStatus: MarketplaceRow["coverageStatus"], codes: string[]): MarketplaceRow["collectionPriority"] {
  if (coverageStatus === "no_evidence" || codes.includes("contradicting_public_reports")) return "high";
  if (coverageStatus === "stale" || codes.includes("missing_public_channel_evidence")) return "medium";
  if (coverageStatus === "thin" || codes.includes("single_source_family")) return "low";
  return "none";
}
function evidenceGradeFor(evidenceCount: number): MarketplaceRow["evidenceGrade"] { return evidenceCount >= 2 ? "corroborated" : evidenceCount === 1 ? "single_source" : "unverified"; }
function isActionable(confidence: number, evidenceCount: number, freshnessStatus: MarketplaceRow["freshnessStatus"]): boolean { return confidence >= 0.6 && evidenceCount > 0 && (freshnessStatus === "current" || freshnessStatus === "recent"); }
