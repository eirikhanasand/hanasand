import { buildHostedDefaultParserLift } from "./hostedDefaultParserLift.ts";
import type { ActorInput, EvidenceSourceFamily, HostedDefaultParserLiftContract, MarketplaceRow, PaidRowDecision, RemediationOwner, TiSearchResponse } from "./types.ts";
import { boolFromUnknown, clampInt, clampNumber, normalizeFacet, normalizeKey, numberFromUnknown, record, recordArray, round, safeIso, safePublicUrl, safeString, sourceType, stableHash, stringArray, topStrings, uniqueStrings, warningsFor } from "./utils.ts";
import { freshnessFor, qualityFields } from "./rowQuality.ts";

export function relationshipInsightFields(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  quality: ReturnType<typeof qualityFields>,
  context: {
    claimType?: string;
    victimName?: string;
    affectedSectors?: string[];
    countries?: string[];
    ttp?: string;
    attackId?: string;
    tactic?: string;
    title?: string;
    sourceFamilies?: EvidenceSourceFamily[];
    sourceIds?: string[];
    contradictingSourceIds?: string[];
    coverageGapCode?: string;
    confidence?: number;
    observedAt?: string;
  }
): Pick<MarketplaceRow,
  | "relationshipSummary"
  | "relationshipPivotTypes"
  | "relationshipPivots"
  | "whyActionable"
  | "freshnessDelta"
  | "confidenceDelta"
  | "contradictionHints"
  | "corroborationState"
  | "nextSearchPivots"
> {
  const relationshipPivots = uniqueStrings([
    context.victimName ? `victim:${context.victimName}` : undefined,
    ...(context.affectedSectors ?? []).map((sector) => `sector:${sector}`),
    ...(context.countries ?? []).map((country) => `country:${country}`),
    context.ttp ? `ttp:${context.ttp}` : undefined,
    context.attackId ? `attack:${context.attackId}` : undefined,
    context.tactic ? `tactic:${context.tactic}` : undefined,
    ...(context.sourceFamilies ?? quality.sourceFamilies).map((family) => `source_family:${family}`),
    context.claimType ? `claim:${context.claimType}` : undefined,
    context.coverageGapCode ? `gap:${context.coverageGapCode}` : undefined
  ].filter((value): value is string => Boolean(value))).slice(0, 10);
  const pivotTypes = uniqueStrings(relationshipPivots.map((pivot) => pivot.split(":")[0] ?? pivot)).slice(0, 8);
  const contradictionHints = contradictionHintsFor(response, context);
  const corroborationState = contradictionHints.length
    ? "contradicted"
    : quality.evidenceGrade === "corroborated"
      ? "corroborated"
      : quality.evidenceGrade;
  const freshnessDelta = freshnessDeltaFor(context.observedAt ?? response.lastSeen, rowType);
  const confidenceDelta = confidenceDeltaFor(context.confidence ?? response.confidence, response.confidence);
  const whyActionable = whyActionableFor(response, rowType, quality, context, corroborationState);
  const nextSearchPivots = nextSearchPivotsFor(response, context, quality, relationshipPivots);
  return {
    relationshipSummary: relationshipSummaryFor(response, rowType, context, relationshipPivots, corroborationState),
    relationshipPivotTypes: pivotTypes,
    relationshipPivots,
    whyActionable,
    freshnessDelta,
    confidenceDelta,
    contradictionHints,
    corroborationState,
    nextSearchPivots
  };
}

function relationshipSummaryFor(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  context: Parameters<typeof relationshipInsightFields>[3],
  pivots: string[],
  corroborationState: MarketplaceRow["corroborationState"]
): string {
  if (rowType === "coverage_gap") return `${response.query} needs ${context.coverageGapCode?.replaceAll("_", " ") ?? "coverage"} follow-up before the row is complete.`;
  if (rowType === "target" && context.affectedSectors?.[0]) return `${response.query} is linked to ${context.affectedSectors[0]} targeting with ${corroborationState} public support.`;
  if (rowType === "ttp" && (context.attackId || context.ttp)) return `${response.query} is linked to ${context.attackId ?? context.ttp} with ${corroborationState} public support.`;
  if (context.victimName) return `${response.query} is linked to victim ${context.victimName} with ${corroborationState} public support.`;
  if (context.claimType) return `${response.query} has a ${context.claimType.replaceAll("_", " ")} row with ${corroborationState} public support.`;
  if (pivots.length) return `${response.query} row exposes ${pivots.slice(0, 3).join(", ")} pivots.`;
  return `${response.query} row is a ${rowType} summary with ${corroborationState} public support.`;
}

function whyActionableFor(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  quality: ReturnType<typeof qualityFields>,
  context: Parameters<typeof relationshipInsightFields>[3],
  corroborationState: MarketplaceRow["corroborationState"]
): string[] {
  const bullets = new Set<string>();
  if (quality.freshnessStatus === "current") bullets.add("Fresh public evidence is available for immediate monitoring.");
  if (quality.freshnessStatus === "recent") bullets.add("Recent public evidence is available, but cadence should be checked.");
  if (corroborationState === "corroborated") bullets.add("Multiple evidence sources support this row.");
  if (corroborationState === "single_source") bullets.add("Single-source row: useful as a lead, not a confirmed fact.");
  if (corroborationState === "contradicted") bullets.add("Contradicting public reports require analyst review before promotion.");
  if (context.victimName) bullets.add("Victim pivot can drive defensive outreach or exposure review.");
  if (context.affectedSectors?.length) bullets.add("Sector pivot supports watchlist filtering and enrichment.");
  if (context.countries?.length) bullets.add("Country pivot supports regional monitoring.");
  if (context.attackId || context.ttp) bullets.add("TTP pivot supports ATT&CK-based detection review.");
  if (rowType === "coverage_gap") bullets.add("Coverage gap explains what to add before treating the result as complete.");
  if (response.status === "partial" || response.status === "queued") bullets.add("Run is still polling; keep the row attached to the active run.");
  return [...bullets].slice(0, 5);
}

function contradictionHintsFor(response: TiSearchResponse, context: Parameters<typeof relationshipInsightFields>[3]): string[] {
  const hints = new Set<string>();
  if ((context.contradictingSourceIds?.length ?? 0) > 0) hints.add("contradicting_source_ids_present");
  if (response.recentActivity.some((item) => (item.contradictingSourceIds?.length ?? 0) > 0)) hints.add("query_has_contradicting_public_reports");
  if (response.notes.some((note) => /contradict|conflict|dispute/i.test(note))) hints.add("analyst_note_mentions_conflict");
  return [...hints].sort();
}

function nextSearchPivotsFor(
  response: TiSearchResponse,
  context: Parameters<typeof relationshipInsightFields>[3],
  quality: ReturnType<typeof qualityFields>,
  relationshipPivots: string[]
): string[] {
  const pivots = new Set<string>();
  if (context.victimName) pivots.add(context.victimName);
  for (const sector of context.affectedSectors ?? []) pivots.add(`${sector} threats`);
  for (const country of context.countries ?? []) pivots.add(`${country} cyber activity`);
  if (context.ttp) pivots.add(context.ttp);
  if (context.attackId) pivots.add(context.attackId);
  if (quality.missingSourceFamilies.includes("public_channel")) pivots.add(`${response.query} public channel`);
  if (quality.missingSourceFamilies.includes("clear_web")) pivots.add(`${response.query} advisories`);
  for (const pivot of relationshipPivots) {
    if (pivot.startsWith("source_family:")) pivots.add(`${response.query} ${pivot.slice("source_family:".length)}`);
  }
  return [...pivots].filter(Boolean).slice(0, 6);
}

function freshnessDeltaFor(value: string, rowType: MarketplaceRow["rowType"]): MarketplaceRow["freshnessDelta"] {
  const freshness = freshnessFor(value);
  if (rowType === "coverage_gap") return freshness === "unknown" ? "unknown" : "stale";
  if (freshness === "current") return "current";
  if (freshness === "recent") return "recent";
  if (freshness === "stale") return "stale";
  return "unknown";
}

function confidenceDeltaFor(rowConfidence: number, responseConfidence: number): MarketplaceRow["confidenceDelta"] {
  const delta = clampNumber(rowConfidence, 0, 1) - clampNumber(responseConfidence, 0, 1);
  if (delta >= 0.05) return "stronger";
  if (delta <= -0.05) return "weaker";
  return "stable";
}
