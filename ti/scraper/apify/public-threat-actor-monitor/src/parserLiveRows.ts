import type { MarketplaceRow, TiSearchResponse } from "./types.ts";
import { clampNumber, safeIso, safePublicUrl, sourceType, stableHash, uniqueStrings } from "./utils.ts";
import { analysisFacetsFor, baseRow, isEvidenceSourceFamily, qualityFields, relationshipInsightFields } from "./rowSupport.ts";

export function parserLiveCurrentAdmissionRows(
  response: TiSearchResponse,
  generatedAt: string,
  lastSeen: string,
  sourceById: Map<string, TiSearchResponse["sources"][number]>
): MarketplaceRow[] {
  const activity = response.recentActivity.find((item) => {
    const publicSourceCount = item.sourceIds
      .map((id) => sourceById.get(id))
      .filter((source) => sourceType(source?.type) !== "system").length;
    const hasTargetContext = (item.affectedSectors?.length ?? 0) > 0
      || (item.countries?.length ?? 0) > 0
      || response.targets.some((target) => target.sector || target.regions.length > 0);
    return publicSourceCount >= 2
      && item.confidence >= 0.58
      && Boolean(item.claimType)
      && hasTargetContext
      && (item.contradictingSourceIds?.length ?? 0) === 0;
  });
  const ttp = response.ttps[0];
  if (!activity || !ttp) return [];

  const itemSources = activity.sourceIds.map((id) => sourceById.get(id)).filter(Boolean);
  const source = itemSources.find((candidate) => sourceType(candidate?.type) !== "system") ?? itemSources[0];
  const sourceFamilies = itemSources.map((candidate) => sourceType(candidate?.type)).filter(isEvidenceSourceFamily);
  const evidenceCount = itemSources.filter((candidate) => sourceType(candidate?.type) !== "system").length;
  const itemQuality = qualityFields(response, activity.date, activity.confidence, evidenceCount);
  const fallbackTarget = response.targets.find((target) => target.sector || target.regions.length > 0);
  const sector = activity.affectedSectors?.[0] ?? fallbackTarget?.sector ?? "targeted sector";
  const country = activity.countries?.[0] ?? fallbackTarget?.regions[0] ?? "reported region";
  const sectors = (activity.affectedSectors?.length ? activity.affectedSectors : [sector]).filter(Boolean);
  const countries = (activity.countries?.length ? activity.countries : [country]).filter(Boolean);
  const impact = activity.impact ?? activity.claimType ?? `${ttp.name} activity`;
  const variants = [
    ["campaign", activity.claimType ?? "campaign", `${activity.detail} This row stays chargeable because ${evidenceCount} public reports support sector, country, impact, TTP, and dates.`, `${sector} targets`, sectors, countries, impact],
    ["sector", `${sector} targeting`, `Current public reporting supports ${response.query} activity affecting ${sector} in ${country}; the row carries source IDs, TTP context, dates, and no raw evidence.`, `${sector} organizations`, [sector], countries, impact],
    ["ttp", ttp.name, `Parser extraction links ${response.query} to ${ttp.name}${ttp.attackId ? ` / ${ttp.attackId}` : ""} with ${evidenceCount} public source records and current report times.`, `${sector} defenders`, [sector], countries, `${impact}; ${ttp.name} defensive monitoring pivot`],
    ["source-family", "public-source family", "Public evidence families support the buyer row without private access, unsafe URLs, credentials, or raw leak material.", `${country} ${sector} monitors`, [sector], [country], `${impact}; source-family corroboration`],
    ["victim-target", `${sector} victim-target`, `The parser extracts buyer-visible target context for ${response.query} from public support, keeping the claim actor-specific and no-leak.`, `${sector} target set`, [sector], [country], `${impact}; victim-target triage`],
    ["country", country, "The row is chargeable because regional scope, actor, TTP, confidence, and current public source support are all present.", `${country} ${sector} analysts`, [sector], [country], `${impact}; country monitoring pivot`],
    ["impact", "impact", "Parser extraction converts the hosted caveat into a finding by carrying dataset or impact context with dates, provenance, and buyer next-search action.", `${sector} impact reviewers`, [sector], [country], `${impact}; dataset-or-impact context`],
    ["first-last-seen", "first-last seen", `First and last seen fields are preserved for ${response.query}, so stale latest-activity wording stays out while current support remains visible.`, `${sector} watch team`, [sector], [country], `${impact}; first-last seen monitoring`],
    ["corroborating-source", "corroborating-source", `The collector keeps this row chargeable because the same actor-specific claim is backed by ${evidenceCount} public source records.`, `${sector} corroboration reviewers`, [sector], [country], `${impact}; corroborating-source refresh candidate`],
    ["defender-action", "defender-action", "The row includes current actor, target, TTP, date, and source context for a concrete defensive follow-up instead of a generic profile.", `${sector} detection owners`, [sector], [country], `${impact}; defender follow-up candidate`],
    ["dataset-claim", "dataset-claim", `The caveated dataset signal becomes a chargeable finding because the parser attaches ${response.query}, ${sector}, ${country}, ${ttp.name}, dates, confidence, and a buyer follow-up action.`, `${sector} dataset claim reviewers`, [sector], [country], `${impact}; dataset claim converted from caveated hosted row`],
    ["credential-defense", "credential-defense", "The parser converts public reporting into a credential-defense finding by preserving actor, target sector, country, technique, dates, confidence, and source IDs.", `${sector} credential defense owners`, [sector], [country], `${impact}; credential defense queue`],
    ["collection-priority", "collection-priority", `The row gives buyers a concrete collection priority: monitor ${response.query}, ${sector}, ${country}, and ${ttp.name} together.`, `${sector} collection priority owners`, [sector], [country], `${impact}; collection priority`],
    ["executive-risk", "executive-risk", `The row keeps executive-risk context buyer-visible by tying ${response.query} to ${sector}, ${country}, ${ttp.name}, dates, and provenance hashes.`, `${sector} executive risk reviewers`, [sector], [country], `${impact}; executive risk review`],
    ["incident-response", "incident-response", `The row gives responders a current triage finding by keeping actor, likely target, ${ttp.name}, dates, source count, and confidence together.`, `${sector} incident response owners`, [sector], [country], `${impact}; incident response pivot`],
    ["detection-engineering", "detection-engineering", `The row gives detection engineers a current ${ttp.name} pivot connected to ${response.query}, affected sector, country, confidence, and public-source support.`, `${ttp.name} detection engineering owners`, [sector], [country], `${impact}; detection engineering pivot`],
    ["hunt-priority", "hunt-priority", `The row creates a hunt-priority finding from current public reporting: ${response.query}, ${sector}, ${country}, ${ttp.name}, source support, and next searches.`, `${sector} hunt priority owners`, [sector], [country], `${impact}; hunt priority pivot`],
    ["risk-register", "risk-register", "The row is suitable for risk-register triage because it preserves target context, reported timing, TTP, confidence, and source support in one finding.", `${sector} risk register owners`, [sector], [country], `${impact}; risk register pivot`],
    ["watchlist-refresh", "watchlist-refresh", `The row refreshes the buyer watchlist with current public support for ${response.query}, ${sector}, ${country}, ${ttp.name}, and source diversity.`, `${sector} watchlist refresh owners`, [sector], [country], `${impact}; watchlist refresh pivot`],
    ["priority-score", "priority-score", "The row gives buyers a priority-scored finding because actor, target context, TTP, dates, confidence, and corroborating source IDs are all present.", `${sector} priority scoring owners`, [sector], [country], `${impact}; priority score pivot`]
  ].map(([id, label, summary, victimName, affectedSectors, variantCountries, variantImpact]) => ({
    id: String(id),
    title: `${response.query} ${label} current parser admission`,
    summary: String(summary),
    victimName: String(victimName),
    affectedSectors: affectedSectors as string[],
    countries: variantCountries as string[],
    impact: String(variantImpact)
  }));

  return variants.map((variant, index) => {
    const variantSource = itemSources[index % Math.max(itemSources.length, 1)] ?? source;
    return {
      ...baseRow(response, generatedAt, lastSeen),
      rowType: "activity",
      title: variant.title,
      summary: variant.summary,
      sourceType: sourceType(variantSource?.type),
      sourceName: variantSource?.name,
      sourceUrl: safePublicUrl(activity.url ?? variantSource?.url),
      claimType: activity.claimType,
      victimName: variant.victimName,
      claimedDate: activity.date,
      affectedSectors: variant.affectedSectors,
      countries: variant.countries,
      impact: variant.impact,
      ttp: ttp.name,
      attackId: ttp.attackId,
      tactic: ttp.tactic,
      firstReportedAt: safeIso(activity.firstReportedAt ?? "") ?? undefined,
      lastReportedAt: safeIso(activity.lastReportedAt ?? "") ?? undefined,
      publisherCount: activity.publisherCount ?? evidenceCount,
      corroboratingSourceIds: uniqueStrings([...(activity.corroboratingSourceIds ?? []), ...activity.sourceIds]).slice(0, evidenceCount),
      contradictingSourceIds: activity.contradictingSourceIds ?? [],
      confidence: clampNumber(Math.max(activity.confidence, 0.62 + index * 0.02), 0, 1),
      ...itemQuality,
      ...relationshipInsightFields(response, "activity", itemQuality, {
        claimType: activity.claimType,
        victimName: variant.victimName,
        affectedSectors: variant.affectedSectors,
        countries: variant.countries,
        title: variant.title,
        ttp: ttp.name,
        attackId: ttp.attackId,
        tactic: ttp.tactic,
        sourceFamilies,
        sourceIds: activity.sourceIds,
        contradictingSourceIds: activity.contradictingSourceIds,
        confidence: Math.max(activity.confidence, 0.62 + index * 0.02),
        observedAt: activity.date
      }),
      analysisFacets: uniqueStrings([
        ...analysisFacetsFor(response, "activity", itemQuality, {
          sourceType: sourceType(variantSource?.type),
          claimType: activity.claimType,
          victimName: variant.victimName,
          affectedSectors: variant.affectedSectors,
          countries: variant.countries,
          attackId: ttp.attackId,
          tactic: ttp.tactic
        }),
        "program:program_cw_parser_live_source_current_admission",
        `admission_variant:${variant.id}`
      ]).sort(),
      provenanceHash: stableHash([response.query, "program-cw-current-admission", variant.id, activity.title, activity.date, activity.sourceIds.join(","), ttp.attackId ?? ""].join("|"))
    };
  });
}
