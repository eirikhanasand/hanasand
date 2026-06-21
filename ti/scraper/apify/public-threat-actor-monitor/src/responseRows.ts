import type { MarketplaceRow, TiSearchResponse } from "./types.ts";
import type { NormalizedInput } from "./actorRuntime.ts";
import { clampNumber, safeIso, safePublicUrl, sourceType, stableHash } from "./utils.ts";
import { parserLiveCurrentAdmissionRows } from "./parserLiveRows.ts";
import { withPaidRowDecision } from "./paidRows.ts";
import { analysisFacetsFor, baseRow, coverageGapRows, isEvidenceSourceFamily, qualityFields, relationshipInsightFields } from "./rowSupport.ts";

export function normalizeResponse(response: TiSearchResponse, input: NormalizedInput): MarketplaceRow[] {
  const sourceById = new Map(response.sources.map((source) => [source.id, source]));
  const generatedAt = safeIso(response.generatedAt) ?? new Date().toISOString();
  const lastSeen = safeIso(response.lastSeen) ?? generatedAt;
  const rows: MarketplaceRow[] = [baseRow(response, generatedAt, lastSeen)];

  if (input.includeActivity) {
    for (const item of response.recentActivity) {
      const itemSources = item.sourceIds.map((id) => sourceById.get(id)).filter(Boolean);
      const source = itemSources.find((candidate) => sourceType(candidate?.type) !== "system") ?? itemSources[0];
      const evidenceCount = itemSources.filter((candidate) => sourceType(candidate?.type) !== "system").length;
      const itemQuality = qualityFields(response, item.date, item.confidence, evidenceCount);
      const activityTtp = response.ttps[0];
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "activity",
        title: item.title,
        summary: item.detail,
        sourceType: sourceType(source?.type),
        sourceName: source?.name,
        sourceUrl: safePublicUrl(item.url ?? source?.url),
        claimType: item.claimType,
        victimName: item.victimName,
        claimedDate: item.date,
        affectedSectors: item.affectedSectors,
        countries: item.countries,
        impact: item.impact,
        ttp: activityTtp?.name,
        attackId: activityTtp?.attackId,
        tactic: activityTtp?.tactic,
        firstReportedAt: safeIso(item.firstReportedAt ?? "") ?? undefined,
        lastReportedAt: safeIso(item.lastReportedAt ?? "") ?? undefined,
        publisherCount: item.publisherCount ?? evidenceCount,
        corroboratingSourceIds: item.corroboratingSourceIds ?? [],
        contradictingSourceIds: item.contradictingSourceIds ?? [],
        confidence: clampNumber(item.confidence, 0, 1),
        ...itemQuality,
        ...relationshipInsightFields(response, "activity", itemQuality, {
          claimType: item.claimType,
          victimName: item.victimName,
          affectedSectors: item.affectedSectors,
          countries: item.countries,
          title: item.title,
          ttp: activityTtp?.name,
          attackId: activityTtp?.attackId,
          tactic: activityTtp?.tactic,
          sourceFamilies: itemSources.map((candidate) => sourceType(candidate?.type)).filter(isEvidenceSourceFamily),
          sourceIds: item.sourceIds,
          contradictingSourceIds: item.contradictingSourceIds,
          confidence: item.confidence,
          observedAt: item.date
        }),
        analysisFacets: analysisFacetsFor(response, "activity", itemQuality, {
          sourceType: sourceType(source?.type),
          claimType: item.claimType,
          victimName: item.victimName,
          affectedSectors: item.affectedSectors,
          countries: item.countries,
          attackId: activityTtp?.attackId,
          tactic: activityTtp?.tactic
        }),
        provenanceHash: stableHash([response.query, item.title, item.detail, item.date, item.sourceIds.join(","), activityTtp?.attackId ?? ""].join("|"))
      });
    }
    rows.push(...parserLiveCurrentAdmissionRows(response, generatedAt, lastSeen, sourceById));
  }

  if (input.includeTargets) {
    for (const target of response.targets) {
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "target",
        title: target.sector,
        summary: target.rationale,
        sector: target.sector,
        regions: target.regions,
        confidence: clampNumber(target.confidence, 0, 1),
        ...relationshipInsightFields(response, "target", qualityFields(response, lastSeen, target.confidence, response.sources.length), {
          affectedSectors: [target.sector],
          countries: target.regions,
          title: target.sector,
          confidence: target.confidence,
          observedAt: lastSeen
        }),
        analysisFacets: analysisFacetsFor(response, "target", qualityFields(response, lastSeen, target.confidence, response.sources.length), {
          affectedSectors: [target.sector]
        }),
        provenanceHash: stableHash([response.query, target.sector, target.regions.join(","), target.rationale].join("|"))
      });
    }
  }

  if (input.includeTtps) {
    for (const ttp of response.ttps) {
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "ttp",
        title: ttp.name,
        summary: ttp.detail,
        ttp: ttp.name,
        attackId: ttp.attackId,
        tactic: ttp.tactic,
        confidence: clampNumber(ttp.confidence, 0, 1),
        ...relationshipInsightFields(response, "ttp", qualityFields(response, lastSeen, ttp.confidence, response.sources.length), {
          ttp: ttp.name,
          attackId: ttp.attackId,
          tactic: ttp.tactic,
          title: ttp.name,
          confidence: ttp.confidence,
          observedAt: lastSeen
        }),
        analysisFacets: analysisFacetsFor(response, "ttp", qualityFields(response, lastSeen, ttp.confidence, response.sources.length), {
          attackId: ttp.attackId,
          tactic: ttp.tactic
        }),
        provenanceHash: stableHash([response.query, ttp.name, ttp.attackId ?? "", ttp.tactic, ttp.detail].join("|"))
      });
    }
  }

  if (input.includeSources) {
    for (const source of response.sources) {
      if (sourceType(source.type) === "system") continue;
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "source",
        title: source.name,
        summary: source.provenance,
        sourceType: sourceType(source.type),
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: safePublicUrl(source.url),
        provenance: source.provenance,
        confidence: clampNumber(response.confidence, 0, 1),
        ...relationshipInsightFields(response, "source", qualityFields(response, lastSeen, response.confidence, response.sources.length), {
          sourceFamilies: [sourceType(source.type)].filter(isEvidenceSourceFamily),
          sourceIds: [source.id],
          title: source.name,
          confidence: response.confidence,
          observedAt: lastSeen
        }),
        analysisFacets: analysisFacetsFor(response, "source", qualityFields(response, lastSeen, response.confidence, response.sources.length), {
          sourceType: sourceType(source.type)
        }),
        provenanceHash: stableHash([response.query, source.id, source.provenance].join("|"))
      });
    }
  }

  if (input.includeDatasets) {
    for (const dataset of response.datasets) {
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "dataset",
        title: dataset.name,
        summary: dataset.coverage,
        datasetName: dataset.name,
        datasetType: dataset.type,
        datasetStatus: dataset.status,
        coverage: dataset.coverage,
        sourceUrl: safePublicUrl(dataset.url),
        sourceType: sourceType(dataset.type),
        confidence: clampNumber(response.confidence, 0, 1),
        ...relationshipInsightFields(response, "dataset", qualityFields(response, lastSeen, response.confidence, response.sources.length), {
          title: dataset.name,
          confidence: response.confidence,
          observedAt: lastSeen
        }),
        analysisFacets: analysisFacetsFor(response, "dataset", qualityFields(response, lastSeen, response.confidence, response.sources.length), {
          sourceType: sourceType(dataset.type)
        }),
        provenanceHash: stableHash([response.query, dataset.name, dataset.type, dataset.coverage, dataset.status].join("|"))
      });
    }
  }

  if (input.includeCoverageGaps) {
    rows.push(...coverageGapRows(response, generatedAt, lastSeen));
  }

  return rows.map(withPaidRowDecision);
}
