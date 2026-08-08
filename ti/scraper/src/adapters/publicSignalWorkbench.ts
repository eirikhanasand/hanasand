import { nowIso } from "../utils.ts";
import { buildActorSourceCoverageMatrix } from "./publicSignalCoverage.ts";
import { deltaFromAdvisory, deltaFromDarkweb, deltaFromEvidence } from "./publicSignalDeltas.ts";
import { FAMILIES, missingFamilies } from "./publicSignalFamilies.ts";
import { selectSources } from "./publicSignalSources.ts";
import { buildPublicAdvisoryCorrelation, buildPublicConflictContradictionResolver, buildPublicCoverageFreshnessValue, buildPublicSignalLiveCollectionLoopDto, buildPublicSignalValueImpact } from "./publicSignalValue.ts";
import type { PublicSignalFusionInput } from "./publicSignalTypes.ts";

export function buildPublicSignalFusionWorkbench(input: PublicSignalFusionInput): any {
  const generatedAt = input.generatedAt ?? nowIso();
  const selectedSources = selectSources(input.sources ?? [], input.query, input.maxSelectedSources ?? 25);
  const publicSignalDeltas = [
    ...((input.evidence ?? []).map((item: any) => deltaFromEvidence(item, generatedAt))),
    ...((input.advisorySignals ?? []).map((item: any) => deltaFromAdvisory(item, generatedAt))),
    ...((input.darkwebMetadataSignals ?? []).map((item: any) => deltaFromDarkweb(item, generatedAt)))
  ].filter((delta) => delta.summary || delta.title || delta.matchedEntities);
  const actorSourceCoverageMatrix = buildActorSourceCoverageMatrix({ query: input.query, sources: input.sources ?? [], deltas: publicSignalDeltas, generatedAt });
  const publicSignalLiveCollectionLoop = buildPublicSignalLiveCollectionLoopDto({ query: input.query, sources: selectedSources, deltas: publicSignalDeltas, generatedAt });
  const observedFamilies = actorSourceCoverageMatrix.rows.filter((row: any) => row.status === "ready").map((row: any) => row.family);
  const missingObservedFamilies = FAMILIES.filter((family) => !observedFamilies.includes(family));
  return { query: input.query, generatedAt, status: publicSignalDeltas.length ? "ready" : selectedSources.length ? "partial" : "coverage_gap", selectedSources, familyCoverage: { familiesCovered: observedFamilies, missingFamilies: missingObservedFamilies, diversityScore: observedFamilies.length, evidenceBacked: true }, publicSignalDeltas, sourceCoverageGaps: missingObservedFamilies.map((family) => ({ family, reason: "no retained evidence observed" })), coverageStatus: actorSourceCoverageMatrix.status, actorSourceCoverageMatrix, publicSignalLiveCollectionLoop, publicSignalValueImpact: buildPublicSignalValueImpact({ publicSignalDeltas, selectedSources, generatedAt }), publicCoverageFreshnessValue: buildPublicCoverageFreshnessValue({ publicSignalDeltas, selectedSources, generatedAt }), advisoryCorrelation: buildPublicAdvisoryCorrelation({ deltas: publicSignalDeltas, generatedAt }), publicConflictContradictionResolver: buildPublicConflictContradictionResolver({ deltas: publicSignalDeltas, generatedAt }), analystSourceWorkbench: { rows: selectedSources, action: "collect_public_metadata" } };
}

export function buildAnalystPublicSourceWorkbench(input: any): any {
  const workbench = buildPublicSignalFusionWorkbench(input);
  return { generatedAt: workbench.generatedAt, rows: workbench.selectedSources, decisions: workbench.selectedSources.map((source: any) => ({ sourceId: source.sourceId, action: "collect_public_metadata" })) };
}
