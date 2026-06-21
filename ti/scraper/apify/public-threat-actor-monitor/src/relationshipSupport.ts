import { buildHostedDefaultParserLift } from "./hostedDefaultParserLift.ts";
import type { ActorInput, HostedDefaultParserLiftContract, MarketplaceRow, PaidRowDecision, RemediationOwner, TiSearchResponse } from "./types.ts";
import { boolFromUnknown, clampInt, clampNumber, normalizeFacet, normalizeKey, numberFromUnknown, record, recordArray, round, safeIso, safePublicUrl, safeString, sourceType, stableHash, stringArray, topStrings, uniqueStrings, warningsFor } from "./utils.ts";
import { freshnessFor, qualityFields } from "./rowQuality.ts";
import { whyActionableFor } from "./relationship/actionable.ts";
import { confidenceDeltaFor, freshnessDeltaFor } from "./relationship/deltas.ts";
import { contradictionHintsFor, nextSearchPivotsFor } from "./relationship/pivots.ts";
import { relationshipSummaryFor } from "./relationship/summary.ts";
import type { RelationshipInsightContext, RelationshipInsightFields } from "./relationship/types.ts";

export function relationshipInsightFields(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  quality: ReturnType<typeof qualityFields>,
  context: RelationshipInsightContext
): RelationshipInsightFields {
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
