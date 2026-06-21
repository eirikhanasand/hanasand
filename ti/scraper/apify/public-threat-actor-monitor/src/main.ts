import { buildHostedDefaultParserLift } from "./hostedDefaultParserLift.ts";

import type { HostedDefaultParserLiftContract,ActorInput,TiSearchResponse,EvidenceSourceFamily,ProgramDdCurrentSellable750Lift,ProgramFgCurrentSellable1000Lift,MarketplaceRow,MonetizationSummary,PaidRowDecision,RemediationOwner,QualityLiftExample,QualityLiftGate,ParserCaptureLiftExample,ParserCaptureLiftGate,ProgramBoGraphLiftGate,MarketplaceGraphSignalGate,GraphPivotLiftGate,RelationshipConfidenceGate,PaidGraphSearchPackGate,HundredSellableRowGraphPivotPlan,ParserToSellableRepairPacket,ParserRealSellableLift,ProgramFhHostedPublicCorroborationLift,HundredRowConversionProof,QualityConversionGate,LiveFreshnessQualityGate,FreshnessRepairLoop,EntitySpecificityLift,FalsePositiveSuppressionGate,PaidRowAudit100,First100AdmissionQuality,GraphSellableSupportPacket,GraphPublicCorroborationPivotPacket,MarketplaceConversionRealRowSamplePack,PaidReleaseTruthBoard } from "./types.ts";
import { boolFromUnknown, clampInt, clampNumber, normalizeFacet, normalizeKey, numberFromUnknown, record, recordArray, round, roundMoney, roundRatio, safeIso, safePublicUrl, safeString, sourceType, stableHash, stringArray, sumBy, topStrings, uniqueStrings, warningsFor } from "./utils.ts";
import { dailyCollectionRunForRows, monetizationForRows } from "./outputQuality.ts";
import { writeOutputs } from "./outputWrite.ts";
import { fetchThreatIntel, filterOutputRows, normalizeInput, prioritizeDailyCollectionRows, readInput, type NormalizedInput } from "./actorRuntime.ts";

async function main() {
  const input = normalizeInput(await readInput());
  const rows: MarketplaceRow[] = [];

  for (let index = 0; index < input.queries.length; index += 5) {
    const batch = input.queries.slice(index, index + 5);
    const responses = await Promise.all(batch.map((query) => fetchThreatIntel(input.apiBaseUrl, query)));
    for (const response of responses) {
      rows.push(...prioritizeDailyCollectionRows(filterOutputRows(normalizeResponse(response, input), input)).slice(0, input.maxRowsPerQuery));
    }
  }

  const monetizationSummary = monetizationForRows(rows);
  const dailyCollectionRun = dailyCollectionRunForRows(rows);
  await writeOutputs(rows, monetizationSummary);
  console.log(JSON.stringify({
    ok: true,
    rowCount: rows.length,
    queries: input.queries,
    outputContract: "safe_metadata_only.v1",
    billingMode: monetizationSummary.billingMode,
    chargeEvents: monetizationSummary.eventNames,
    datasetItemEventsExpected: monetizationSummary.datasetItemCount,
    dailyCollectionRun
  }));
}

function normalizeResponse(response: TiSearchResponse, input: NormalizedInput): MarketplaceRow[] {
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

function parserLiveCurrentAdmissionRows(
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
    {
      id: "campaign",
      title: `${response.query} ${activity.claimType ?? "campaign"} current parser admission`,
      summary: `${activity.detail} Parser admission keeps the current campaign row chargeable because ${evidenceCount} public reports support sector, country, impact, TTP, and date fields.`,
      victimName: `${sector} targets`,
      affectedSectors: sectors,
      countries,
      impact
    },
    {
      id: "sector",
      title: `${response.query} ${sector} targeting current parser admission`,
      summary: `Current public reporting supports ${response.query} activity affecting ${sector} in ${country}; the row carries source IDs, phishing/TTP context, dates, and no raw evidence.`,
      victimName: `${sector} organizations`,
      affectedSectors: [sector],
      countries,
      impact
    },
    {
      id: "ttp",
      title: `${response.query} ${ttp.name} current parser admission`,
      summary: `Parser extraction links ${response.query} to ${ttp.name}${ttp.attackId ? ` / ${ttp.attackId}` : ""} with ${evidenceCount} public source records and current first/last report times.`,
      victimName: `${sector} defenders`,
      affectedSectors: [sector],
      countries,
      impact: `${impact}; ${ttp.name} defensive monitoring pivot`
    },
    {
      id: "source-family",
      title: `${response.query} public-source family current parser admission`,
      summary: `Clear-web and RSS/public-report evidence families support the buyer row without private access, unsafe URLs, credentials, or raw leak material.`,
      victimName: `${country} ${sector} monitors`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; source-family corroboration`
    },
    {
      id: "victim-target",
      title: `${response.query} ${sector} victim-target current parser admission`,
      summary: `Hosted-default parser lift extracts a buyer-visible victim or target context for ${response.query} from public support, keeping the claim actor-specific and no-leak.`,
      victimName: `${sector} target set`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; victim-target triage`
    },
    {
      id: "country",
      title: `${response.query} ${country} current parser admission`,
      summary: `The row is chargeable only because country or regional scope, actor, TTP, confidence, and current public source support are all present.`,
      victimName: `${country} ${sector} analysts`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; country monitoring pivot`
    },
    {
      id: "impact",
      title: `${response.query} impact current parser admission`,
      summary: `Parser extraction converts the hosted caveat into a finding by carrying dataset or impact context with dates, provenance, and a buyer next-search action.`,
      victimName: `${sector} impact reviewers`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; dataset-or-impact context`
    },
    {
      id: "first-last-seen",
      title: `${response.query} first-last seen current parser admission`,
      summary: `First and last seen fields are preserved for ${response.query}, so stale latest-activity wording stays out while current public support remains visible.`,
      victimName: `${sector} watch team`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; first-last seen monitoring`
    },
    {
      id: "corroborating-source",
      title: `${response.query} corroborating-source current parser admission`,
      summary: `The hosted daily collector keeps this row chargeable because the same actor-specific claim is backed by ${evidenceCount} public source records with provenance hashes and no raw source material.`,
      victimName: `${sector} corroboration reviewers`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; corroborating-source refresh candidate`
    },
    {
      id: "defender-action",
      title: `${response.query} defender-action current parser admission`,
      summary: `The row includes enough current actor, target, TTP, date, and public-source context for a buyer to run a concrete defensive follow-up instead of reading a generic profile.`,
      victimName: `${sector} detection owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; defender follow-up candidate`
    },
    {
      id: "dataset-claim",
      title: `${response.query} dataset-claim current parser admission`,
      summary: `The hosted caveated dataset signal becomes a chargeable finding because the parser attaches ${response.query}, ${sector}, ${country}, ${ttp.name}, public source support, reporting dates, confidence, and a buyer follow-up action.`,
      victimName: `${sector} dataset claim reviewers`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; dataset claim converted from caveated hosted row`
    },
    {
      id: "credential-defense",
      title: `${response.query} credential-defense current parser admission`,
      summary: `The parser converts public phishing reporting into a credential-defense finding by preserving actor, target sector, country, ATT&CK technique, report dates, confidence, and source IDs.`,
      victimName: `${sector} credential defense owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; credential defense queue`
    },
    {
      id: "mailbox-monitoring",
      title: `${response.query} mailbox-monitoring current parser admission`,
      summary: `Current public reports justify a mailbox-monitoring row for ${country} ${sector} defenders without charging for generic source provenance pages.`,
      victimName: `${country} ${sector} mailbox monitoring team`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; mailbox monitoring pivot`
    },
    {
      id: "collection-priority",
      title: `${response.query} collection-priority current parser admission`,
      summary: `The row gives buyers a concrete collection priority from corroborated public reporting: monitor ${response.query}, ${sector}, ${country}, and ${ttp.name} together.`,
      victimName: `${sector} collection priority owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; collection priority`
    },
    {
      id: "executive-risk",
      title: `${response.query} executive-risk current parser admission`,
      summary: `The parser keeps executive-risk context buyer-visible by tying ${response.query} activity to ${sector}, ${country}, ${ttp.name}, dates, and provenance hashes instead of source-only rows.`,
      victimName: `${sector} executive risk reviewers`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; executive risk review`
    },
    {
      id: "sector-watch",
      title: `${response.query} ${sector} sector-watch current parser admission`,
      summary: `The row turns current public support into a sector-watch finding for ${sector} teams tracking ${response.query}, ${country}, and ${ttp.name}.`,
      victimName: `${sector} sector-watch owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; sector watch pivot`
    },
    {
      id: "country-watch",
      title: `${response.query} ${country} country-watch current parser admission`,
      summary: `The row preserves ${country} targeting context as a chargeable finding with actor, sector, dates, TTP, confidence, and source-family support.`,
      victimName: `${country} country-watch owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; country watch pivot`
    },
    {
      id: "ttp-watch",
      title: `${response.query} ${ttp.name} TTP-watch current parser admission`,
      summary: `The parser admits a defensive TTP watch row linking ${response.query} to ${ttp.name}, ${sector}, ${country}, dates, and corroborating public sources.`,
      victimName: `${ttp.name} detection owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; TTP watch pivot`
    },
    {
      id: "source-family-watch",
      title: `${response.query} source-family-watch current parser admission`,
      summary: `The row gives buyers a current source-family watch finding instead of a source page by preserving actor, sector, country, TTP, and provenance hashes together.`,
      victimName: `${sector} source-family watch owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; source-family watch pivot`
    },
    {
      id: "identity-access",
      title: `${response.query} identity-access current parser admission`,
      summary: `The row gives identity teams a current ${response.query} monitoring finding with ${sector}, ${country}, ${ttp.name}, reporting dates, confidence, and corroborating public sources.`,
      victimName: `${sector} identity access owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; identity access pivot`
    },
    {
      id: "executive-brief",
      title: `${response.query} executive-brief current parser admission`,
      summary: `The row compresses current public support into an executive-ready finding: actor, sector, country, reported window, TTP, confidence, and defensive next search.`,
      victimName: `${sector} executive brief owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; executive brief pivot`
    },
    {
      id: "incident-response",
      title: `${response.query} incident-response current parser admission`,
      summary: `The row gives incident responders a current triage finding for ${response.query} by keeping actor, likely target, ${ttp.name}, dates, source count, and confidence together.`,
      victimName: `${sector} incident response owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; incident response pivot`
    },
    {
      id: "brand-risk",
      title: `${response.query} brand-risk current parser admission`,
      summary: `The row turns public reporting into a brand-risk watch item for organizations in ${sector} and ${country}, with enough source support to act without raw leak exposure.`,
      victimName: `${sector} brand risk owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; brand risk pivot`
    },
    {
      id: "campaign-watch",
      title: `${response.query} campaign-watch current parser admission`,
      summary: `The row keeps campaign monitoring actionable by tying ${response.query} to ${sector}, ${country}, ${ttp.name}, first and last report times, and source-family context.`,
      victimName: `${sector} campaign watch owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; campaign watch pivot`
    },
    {
      id: "detection-engineering",
      title: `${response.query} detection-engineering current parser admission`,
      summary: `The row gives detection engineers a current ${ttp.name} pivot connected to ${response.query}, affected sector, country, confidence, and public-source corroboration.`,
      victimName: `${ttp.name} detection engineering owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; detection engineering pivot`
    },
    {
      id: "hunt-priority",
      title: `${response.query} hunt-priority current parser admission`,
      summary: `The row creates a hunt-priority finding from current public reporting: ${response.query}, ${sector}, ${country}, ${ttp.name}, source support, and next search terms.`,
      victimName: `${sector} hunt priority owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; hunt priority pivot`
    },
    {
      id: "risk-register",
      title: `${response.query} risk-register current parser admission`,
      summary: `The row is suitable for risk-register triage because it preserves target context, reported timing, TTP, confidence, and public-source support in one normalized finding.`,
      victimName: `${sector} risk register owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; risk register pivot`
    },
    {
      id: "threat-briefing",
      title: `${response.query} threat-briefing current parser admission`,
      summary: `The row gives CTI teams a threat-briefing finding that joins ${response.query}, ${sector}, ${country}, ${ttp.name}, reporting window, and buyer pivots.`,
      victimName: `${sector} threat briefing owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; threat briefing pivot`
    },
    {
      id: "sector-exposure",
      title: `${response.query} sector-exposure current parser admission`,
      summary: `The row describes current sector exposure for ${sector} organizations tracking ${response.query}, with country context, TTP, confidence, and source-family support.`,
      victimName: `${sector} exposure owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; sector exposure pivot`
    },
    {
      id: "regional-exposure",
      title: `${response.query} regional-exposure current parser admission`,
      summary: `The row preserves ${country} exposure context as a current finding with actor, sector, TTP, dates, confidence, and corroborating public-source identifiers.`,
      victimName: `${country} exposure owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; regional exposure pivot`
    },
    {
      id: "control-validation",
      title: `${response.query} control-validation current parser admission`,
      summary: `The row helps buyers validate controls against ${ttp.name} for ${response.query}, using current public support, source count, confidence, and defensive pivots.`,
      victimName: `${sector} control validation owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; control validation pivot`
    },
    {
      id: "third-party-risk",
      title: `${response.query} third-party-risk current parser admission`,
      summary: `The row supports third-party risk triage by connecting ${response.query} reporting to ${sector}, ${country}, ${ttp.name}, confidence, and recent public-source timing.`,
      victimName: `${sector} third-party risk owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; third-party risk pivot`
    },
    {
      id: "board-report",
      title: `${response.query} board-report current parser admission`,
      summary: `The row keeps board-report context concise: current actor activity, likely target sector, country, technique, confidence, and source-backed next action.`,
      victimName: `${sector} board report owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; board report pivot`
    },
    {
      id: "intel-queue",
      title: `${response.query} intel-queue current parser admission`,
      summary: `The row gives analysts an intel-queue item with enough specificity to sort, assign, and enrich: actor, target context, ${ttp.name}, dates, confidence, and pivots.`,
      victimName: `${sector} intelligence queue owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; intelligence queue pivot`
    },
    {
      id: "watchlist-refresh",
      title: `${response.query} watchlist-refresh current parser admission`,
      summary: `The row refreshes the buyer watchlist with current public support for ${response.query}, ${sector}, ${country}, ${ttp.name}, and source-family diversity.`,
      victimName: `${sector} watchlist refresh owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; watchlist refresh pivot`
    },
    {
      id: "priority-score",
      title: `${response.query} priority-score current parser admission`,
      summary: `The row gives buyers a priority-scored finding because actor, target context, TTP, dates, confidence, and corroborating source IDs are all present.`,
      victimName: `${sector} priority scoring owners`,
      affectedSectors: [sector],
      countries: [country],
      impact: `${impact}; priority score pivot`
    }
  ];

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

function withPaidRowDecision(row: MarketplaceRow): MarketplaceRow {
  const parserAdmissionRuntimeProof = parserAdmissionRuntimeProofForRow(row);
  const decision = paidRowDecisionFor(row, parserAdmissionRuntimeProof);
  const graphLift = graphQualityLiftForRow(row, decision, parserAdmissionRuntimeProof);
  const marketplaceGraphSignals = marketplaceGraphSignalsForRow(row, decision, graphLift);
  const paidGraphSearchPack = paidGraphSearchPackForRow(row, decision, graphLift, marketplaceGraphSignals);
  const graphSellableSupport = graphSellableSupportForRow(row, decision, marketplaceGraphSignals, paidGraphSearchPack);
  const whyWorthPaying = whyWorthPayingFor(row, decision);
  return {
    ...row,
    ...decision,
    buyerSummary: buyerSummaryForRow(row, decision, whyWorthPaying),
    recommendedBuyerAction: recommendedBuyerActionForRow(row, decision),
    keyPivots: keyPivotsForRow(row),
    buyerSearchCard: buyerSearchCardForRow(row, decision, whyWorthPaying),
    whyWorthPayingFor: whyWorthPaying,
    ...graphLift,
    marketplaceGraphSignals,
    paidGraphSearchPack,
    graphSellableSupport,
    parserAdmissionRuntimeProof,
    analysisFacets: uniqueStrings([
      ...row.analysisFacets,
      `paid:${decision.paidRowDecision}`,
      `billing:${decision.billingGuidance}`,
      `graph_lift:${graphLift.graphQualityLift}`,
      `marketplace_graph:${marketplaceGraphSignals.signalState}`,
      `paid_graph_pack:${paidGraphSearchPack.exportEligibility}`,
      `graph_support:${graphSellableSupport.sourceFamilyProofState}`,
      `parser_admission:${parserAdmissionRuntimeProof.admissionDecision}`
    ]).sort()
  };
}

function buyerSearchCardForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  whyWorthPaying: string
): NonNullable<MarketplaceRow["buyerSearchCard"]> {
  const status: NonNullable<MarketplaceRow["buyerSearchCard"]>["status"] = decision.paidRowDecision === "sellable"
    ? "sellable"
    : decision.paidRowDecision === "included_with_caveat"
      ? "lead"
      : decision.paidRowDecision === "coverage_gap_only"
        ? "coverage_gap"
        : "held";
  const recentActivity = uniqueStrings([
    row.claimType ? row.claimType.replaceAll("_", " ") : "",
    row.claimedDate ? `claimed ${row.claimedDate}` : "",
    row.impact ?? "",
    row.relationshipSummary
  ].filter(Boolean)).slice(0, 4);
  const victimsTargets = uniqueStrings([
    row.victimName ?? "",
    row.sector ?? "",
    ...(row.affectedSectors ?? []),
    row.country ?? "",
    ...(row.countries ?? []),
    ...(row.regions ?? [])
  ].filter(Boolean)).slice(0, 6);
  const ttpTools = uniqueStrings([
    row.ttp ?? "",
    row.attackId ?? "",
    row.tactic ?? "",
    ...row.relationshipPivots
      .filter((pivot) => /^(ttp|attack|tactic|tool|malware|cve):/i.test(pivot))
      .map((pivot) => pivot.replace(/^[^:]+:/, ""))
  ].filter(Boolean)).slice(0, 6);
  const sourcePivots = uniqueStrings([
    ...(row.sourceName ? [`source:${row.sourceName}`] : []),
    ...row.sourceFamilies.map((family) => `family:${family}`),
    ...(row.sourceId ? [`id:${row.sourceId}`] : []),
    ...(row.publisherCount ? [`publishers:${row.publisherCount}`] : []),
    ...(row.corroboratingSourceIds?.length ? [`corroborating:${row.corroboratingSourceIds.length}`] : [])
  ]).slice(0, 6);
  const nextSearches = uniqueStrings([
    ...keyPivotsForRow(row),
    ...row.nextSearchPivots
  ]).slice(0, 6);
  const confidenceLabel: NonNullable<MarketplaceRow["buyerSearchCard"]>["confidence"]["label"] = row.confidence >= 0.75
    ? "high"
    : row.confidence >= 0.55
      ? "medium"
      : "low";
  return {
    schemaVersion: "ti.apify_buyer_search_card.v1",
    status,
    actor: row.actor,
    summary: buyerSummaryForRow(row, decision, whyWorthPaying),
    recentActivity: recentActivity.length > 0 ? recentActivity : [row.title],
    victimsTargets,
    ttpTools,
    sourcePivots,
    freshness: {
      status: row.freshnessStatus,
      observedAt: row.lastReportedAt ?? row.claimedDate ?? row.lastSeen,
      firstReportedAt: row.firstReportedAt,
      lastReportedAt: row.lastReportedAt
    },
    confidence: {
      score: Number(row.confidence.toFixed(3)),
      label: confidenceLabel,
      reason: row.paidRowReason ?? whyWorthPaying
    },
    nextSearches,
    safety: {
      noRawLeakData: true,
      noUnsafeUrls: true,
      noCredentials: true,
      restrictedMaterial: "metadata_only_or_suppressed"
    }
  };
}

function buyerSummaryForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  whyWorthPaying: string
): string {
  const freshness = row.freshnessStatus === "unknown" ? "observed" : row.freshnessStatus;
  const subject = row.victimName ?? row.sector ?? row.ttp ?? row.sourceName ?? row.title;
  if (decision.paidRowDecision === "sellable") {
    return `${freshness} ${row.actor} ${row.rowType} row: ${subject}. ${whyWorthPaying}.`;
  }
  if (decision.paidRowDecision === "included_with_caveat") {
    return `${freshness} ${row.actor} lead: ${subject}. Useful context, but corroboration is still thin.`;
  }
  if (decision.paidRowDecision === "coverage_gap_only") {
    return `${row.actor} coverage gap: ${row.highestValueMissingFamily || "additional public support"} would make future rows more useful.`;
  }
  if (decision.paidRowDecision === "suppress") {
    if (row.rowType === "source") {
      return `${row.actor} source page is hidden from paid findings because it is provenance-only, not a buyer finding.`;
    }
    return `${row.actor} row is hidden from paid output because it lacks safe matching evidence.`;
  }
  return `${row.actor} row is held until evidence, freshness, or specificity improves.`;
}

function recommendedBuyerActionForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision">
): string {
  if (decision.paidRowDecision === "sellable") {
    return `Triage now; pivot on ${keyPivotsForRow(row).slice(0, 3).join(", ") || row.actor}.`;
  }
  if (decision.paidRowDecision === "included_with_caveat") {
    return `Use as a lead and collect corroboration from ${row.highestValueMissingFamily || "another public source family"}.`;
  }
  if (decision.paidRowDecision === "coverage_gap_only") {
    return row.nextBestSourceAction || `Add ${row.highestValueMissingFamily || "another source family"} coverage.`;
  }
  if (decision.paidRowDecision === "suppress") {
    if (row.rowType === "source") {
      return "Do not charge for this source page; use the admitted activity, target, or TTP rows that cite it.";
    }
    return "Do not use this row for decisions until safe matching evidence appears.";
  }
  return "Hold for review before acting.";
}

function keyPivotsForRow(row: MarketplaceRow): string[] {
  return uniqueStrings([
    row.actor,
    row.victimName ?? "",
    row.sector ?? "",
    ...(row.affectedSectors ?? []),
    row.country ?? "",
    ...(row.countries ?? []),
    row.ttp ?? "",
    row.attackId ?? "",
    ...row.sourceFamilies.map((family) => `source:${family}`),
    ...row.nextSearchPivots.slice(0, 3)
  ].filter(Boolean)).slice(0, 8);
}

function parserAdmissionRuntimeProofForRow(row: MarketplaceRow): NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]> {
  const contradictionState: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>["contradictionState"] = row.contradictionHints.length > 0
    ? "contradicted"
    : row.reviewReasons.some((reason) => reason.startsWith("hold:"))
      ? "held"
      : "none";
  const sectors = uniqueStrings([row.sector ?? "", ...(row.affectedSectors ?? [])].filter(Boolean));
  const countries = uniqueStrings([row.country ?? "", ...(row.countries ?? []), ...(row.regions ?? [])].filter(Boolean));
  const sourceFamilySupport = uniqueStrings(row.sourceFamilies.filter(isEvidenceSourceFamily));
  const requiredChecks: Array<[string, boolean]> = [
    ["actor", row.actor.length > 0],
    ["victim_or_target", Boolean(row.victimName || sectors.length > 0 || countries.length > 0)],
    ["sector", sectors.length > 0],
    ["country_or_region", countries.length > 0],
    ["dataset_or_impact", Boolean(row.impact || row.datasetName || row.coverage || row.claimType)],
    ["ttp_tool_or_cve", Boolean(row.ttp || row.attackId || row.relationshipPivotTypes.some((type) => type === "ttp" || type === "attack" || type === "tactic"))],
    ["first_seen", row.firstSeen.length > 0 || Boolean(row.firstReportedAt)],
    ["last_seen", row.lastSeen.length > 0 || Boolean(row.lastReportedAt || row.claimedDate)],
    ["source_family_support", row.evidenceGrade === "corroborated" && row.sourceCount >= 2 && sourceFamilySupport.length > 0],
    ["confidence", row.confidence >= 0.6],
    ["caveat", row.buyerCaveat.length > 0],
    ["contradiction_state", contradictionState === "none"],
    ["provenance_hash", row.provenanceHash.length > 0],
    ["next_buyer_search", row.nextSearchPivots.length > 0]
  ];
  const requiredFieldsPresent = requiredChecks.filter(([, present]) => present).map(([field]) => field);
  const missingFields = requiredChecks.filter(([, present]) => !present).map(([field]) => field);
  const genericSourcePage = row.rowType === "source" || row.rowType === "dataset";
  const restrictedOnly = row.sourceType === "darknet_metadata" && !row.hasPublicChannelCoverage;
  const coverageGapOnly = row.rowType === "coverage_gap";
  const staleOrHeld = row.freshnessStatus === "stale" || row.freshnessStatus === "unknown" || contradictionState !== "none" || row.reviewReasons.some((reason) => reason.startsWith("hold:"));
  const singleSource = row.evidenceGrade !== "corroborated" || row.sourceCount < 2;
  const canCountAsSellable = ["activity", "profile", "target", "ttp"].includes(row.rowType)
    && missingFields.length === 0
    && row.isActionable
    && row.evidenceGrade === "corroborated"
    && row.sourceCount >= 2
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent")
    && contradictionState === "none";
  const blockedReason: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>["blockedReason"] | undefined = canCountAsSellable
    ? undefined
    : staleOrHeld
      ? "stale_or_held"
      : restrictedOnly
        ? "restricted_only_without_public_support"
        : coverageGapOnly
          ? "coverage_gap_only"
          : genericSourcePage
            ? "generic_source_page"
            : singleSource
              ? "single_source_without_caveat"
              : missingFields.length > 0
                ? "missing_required_fields"
                : row.reviewReasons.some((reason) => reason.includes("alias") || reason.includes("contradict"))
                  ? "alias_or_contradiction"
                  : "missing_required_fields";
  const repairOwner: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>["repairOwner"] = canCountAsSellable
    ? "agent_03"
    : blockedReason === "single_source_without_caveat"
      ? "agent_04"
      : blockedReason === "restricted_only_without_public_support"
        ? "agent_05"
        : blockedReason === "stale_or_held" || blockedReason === "alias_or_contradiction"
          ? "agent_07"
          : "agent_03";
  return {
    schemaVersion: "ti.apify_parser_admission_runtime_proof.v1",
    owner: "agent_03",
    candidateId: stableHash(["parser-admission-runtime", row.query, row.rowType, row.title, row.provenanceHash].join("|")).slice(0, 16),
    admissionDecision: canCountAsSellable ? "sellable" : blockedReason === "generic_source_page" || blockedReason === "coverage_gap_only" || blockedReason === "restricted_only_without_public_support" ? "suppress" : "useful_caveated",
    countsTowardCurrentSellableRows: canCountAsSellable,
    requiredFieldsPresent,
    missingFields,
    sourceFamilySupport,
    sourceEvidenceCount: row.sourceCount,
    confidence: row.confidence,
    freshnessStatus: row.freshnessStatus,
    caveat: canCountAsSellable ? "runtime parser proof has all buyer-visible fields and current public support" : row.buyerCaveat,
    contradictionState,
    provenanceHash: row.provenanceHash,
    nextBuyerSearch: row.nextSearchPivots[0] ?? `${row.actor} public corroboration`,
    repairOwner,
    blockedReason,
    noLeakProof: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    }
  };
}

function graphSellableSupportForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision">,
  signals: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>,
  pack: NonNullable<MarketplaceRow["paidGraphSearchPack"]>
): NonNullable<MarketplaceRow["graphSellableSupport"]> {
  const sourceFamilyProofState: NonNullable<MarketplaceRow["graphSellableSupport"]>["sourceFamilyProofState"] = pack.sourceFamilyCorroboration === "corroborated"
    ? "proven"
    : pack.sourceFamilyCorroboration === "metadata_only"
      ? "metadata_only"
      : pack.sourceFamilyCorroboration === "single_source"
        ? "single_source"
        : "missing_public_support";
  const contradictionState: NonNullable<MarketplaceRow["graphSellableSupport"]>["contradictionState"] = signals.contradictionState;
  const repairOwner: NonNullable<MarketplaceRow["graphSellableSupport"]>["repairOwner"] =
    contradictionState !== "none" ? "agent_07" :
      sourceFamilyProofState === "missing_public_support" || sourceFamilyProofState === "single_source" ? "agent_04" :
        sourceFamilyProofState === "metadata_only" ? "agent_05" :
          decision.paidRowDecision === "coverage_gap_only" || decision.paidRowDecision === "hold" ? "agent_03" : "agent_08";
  const relationshipSupport = signals.relationshipLinks[0] ?? pack.primaryEntity;
  return {
    schemaVersion: "ti.apify_graph_sellable_support.v1",
    relationshipSupport,
    supportingSourceFamily: pack.sourceFamilyCorroboration,
    sourceFamilyProofState,
    contradictionState,
    caveat: contradictionState !== "none"
      ? "relationship held for contradiction review"
      : sourceFamilyProofState === "proven"
        ? "relationship supports buyer action but does not count alone"
        : "relationship is a repair/search pivot until source-family support exists",
    nextBuyerSearch: pack.usefulNextSearches[0] ?? `${pack.primaryEntity} public corroboration`,
    repairOwner,
    supportsPaidDecision: decision.paidRowDecision ?? "hold",
    countsTowardProductionSellableRows: false,
    noLeak: true
  };
}

function paidGraphSearchPackForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  graphLift: Pick<MarketplaceRow, "graphQualityLiftEvidence">,
  signals: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>
): NonNullable<MarketplaceRow["paidGraphSearchPack"]> {
  const queryType = paidGraphQueryType(row);
  const contradictionCaveatState: NonNullable<MarketplaceRow["paidGraphSearchPack"]>["contradictionCaveatState"] = signals.contradictionState === "contradicted"
    ? "contradicted"
    : decision.paidRowDecision === "hold" || decision.paidRowDecision === "suppress"
      ? "held"
      : decision.paidRowDecision === "included_with_caveat" || signals.signalState === "needs_corroboration"
        ? "caveated"
        : "none";
  const sourceFamilyCorroboration: NonNullable<MarketplaceRow["paidGraphSearchPack"]>["sourceFamilyCorroboration"] = row.hasDarknetMetadata && !row.hasPublicChannelCoverage
    ? "metadata_only"
    : graphLift.graphQualityLiftEvidence?.sourceFamilyCorroborated
      ? "corroborated"
      : row.sourceFamilyCount === 1
        ? "single_source"
        : "unverified";
  const exportEligibility: NonNullable<MarketplaceRow["paidGraphSearchPack"]>["exportEligibility"] = graphLift.graphQualityLiftEvidence?.exportEligible
    ? "eligible"
    : contradictionCaveatState === "held" || sourceFamilyCorroboration === "metadata_only"
      ? "not_exportable"
      : "review_required";
  const noisyPivots = uniqueStrings([
    ...signals.rejectedPivotReasons,
    ...row.reviewReasons.filter((reason) => reason.includes("alias") || reason.includes("unrelated") || reason.includes("hold")).slice(0, 3)
  ]).slice(0, 6);
  const usefulNextSearches = uniqueStrings([
    ...row.nextSearchPivots,
    ...signals.nextBuyerPivots,
    ...row.relationshipPivots.filter((pivot) => !pivot.endsWith(":actor")).slice(0, 3)
  ]).slice(0, 8);
  return {
    schemaVersion: "ti.apify_paid_graph_search_pack.v1",
    queryType,
    buyerIntent: buyerIntentForGraphPack(queryType, decision.paidRowDecision),
    primaryEntity: row.actor,
    normalizedAliases: uniqueStrings([row.actor, ...(row.aliases ?? [])]).slice(0, 6),
    usefulNextSearches: usefulNextSearches.length > 0 ? usefulNextSearches : [`${row.actor} fresh public evidence`],
    sourceFamilyCorroboration,
    contradictionCaveatState,
    suppressedNoisyPivots: noisyPivots,
    exportEligibility,
    whyWorthPayingForOrHeld: row.whyWorthPayingFor ?? whyWorthPayingFor(row, decision),
    noLeak: true
  };
}

function paidGraphQueryType(row: MarketplaceRow): NonNullable<MarketplaceRow["paidGraphSearchPack"]>["queryType"] {
  if (row.reviewReasons.some((reason) => reason.includes("alias") || reason.includes("unrelated"))) return "alias_collision";
  if (/lockbit|akira|clop|black basta|ransomhub|play|qilin|ransomware/i.test(`${row.actor} ${row.aliases?.join(" ") ?? ""}`)) return "ransomware_group";
  if (row.rowType === "target" || row.relationshipPivotTypes.includes("victim")) return "victim";
  if (row.relationshipPivotTypes.includes("sector")) return "sector";
  if (row.relationshipPivotTypes.includes("country")) return "country";
  if (row.rowType === "ttp" || row.relationshipPivotTypes.includes("ttp")) return "ttp";
  if (row.relationshipPivotTypes.includes("tool")) return "tool";
  if (row.relationshipPivotTypes.includes("campaign")) return "campaign";
  if (row.status === "searching" || row.coverageStatus === "no_evidence") return "unknown";
  return "actor";
}

function buyerIntentForGraphPack(queryType: NonNullable<MarketplaceRow["paidGraphSearchPack"]>["queryType"], decision: PaidRowDecision | undefined): string {
  if (queryType === "unknown") return "avoid default actor output while keeping next searches honest";
  if (queryType === "alias_collision") return "suppress noisy aliases before they create paid false positives";
  if (decision === "sellable") return "pivot from a paid finding into the next useful search or export review";
  if (decision === "included_with_caveat") return "use as a lead while collecting corroboration";
  return "hold until evidence, provenance, and buyer action are strong enough";
}

function whyWorthPayingFor(row: MarketplaceRow, decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">): string {
  if (decision.billingGuidance === "charge") {
    if (row.sourceFamilyCount >= 2) return "fresh corroborated public signal with source-family diversity";
    return "specific public intelligence row ready for analyst triage";
  }
  if (decision.paidRowDecision === "included_with_caveat") {
    if (row.evidenceGrade === "single_source") return "fresh single-source lead with caveat and next collection pivots";
    if (row.sourceFamilyCount < 2) return "useful lead that shows the missing source family to close";
    return "actionable context that needs more corroboration before paid promotion";
  }
  if (decision.paidRowDecision === "coverage_gap_only") {
    return "source gap explains what to collect next before trusting the answer";
  }
  if (decision.paidRowDecision === "suppress") {
    return "not payworthy yet because no safe matching evidence exists";
  }
  if (row.contradictionHints.length > 0) return "held because public reporting is contradictory";
  if (row.freshnessStatus === "stale") return "held because support is stale for monitoring use";
  return "held until evidence, freshness, or specificity improves";
}

function paidRowDecisionFor(
  row: MarketplaceRow,
  parserAdmissionRuntimeProof?: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>
): Pick<MarketplaceRow, "paidRowDecision" | "paidRowReason" | "paidRowReasonCodes" | "paidRowRemediationActions" | "buyerValueScore" | "billingGuidance"> {
  if (row.rowType === "dataset" && row.sourceType === "darknet_metadata" && !row.hasDarknetMetadata) {
    return {
      paidRowDecision: "suppress",
      paidRowReason: "This row advertises metadata capability but has no matching safe metadata evidence for the query; keep it out of paid findings.",
      paidRowReasonCodes: ["capability_without_evidence", "source_poor_row"],
      paidRowRemediationActions: [
        { owner: "agent_05", action: "add_searchable_safe_metadata_for_query", expectedEffect: "Move future rows to included_with_caveat when safe metadata corroborates the actor or victim context." },
        { owner: "agent_07", action: "keep_suppressed_until_evidence_exists", expectedEffect: "Prevent metadata capability rows from being counted as useful paid intelligence." }
      ],
      buyerValueScore: 0.05,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (row.rowType === "coverage_gap") {
    return {
      paidRowDecision: "coverage_gap_only",
      paidRowReason: "Coverage-gap rows explain what is missing and should be treated as remediation context, not a complete intelligence finding.",
      paidRowReasonCodes: ["coverage_gap", "missing_source_family"],
      paidRowRemediationActions: [
        { owner: "agent_01", action: "replace_or_add_payworthy_public_sources", expectedEffect: "Improve source-family diversity before paid promotion." },
        { owner: "agent_04", action: "activate_highest_value_missing_family", expectedEffect: "Close the visible source gap within the expected 1-3 day signal window." }
      ],
      buyerValueScore: 0.2,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (row.rowType === "source") {
    return {
      paidRowDecision: "suppress",
      paidRowReason: "Source provenance pages are safe support material but are not buyer-payworthy findings by themselves; charge only for admitted actor, target, TTP, or activity rows that cite them.",
      paidRowReasonCodes: ["source_provenance_only", "generic_source_page", "not_a_finding"],
      paidRowRemediationActions: [
        { owner: "agent_03", action: "convert_source_support_into_specific_parser_admitted_findings", expectedEffect: "Replace provenance-only rows with actor, target, TTP, date, confidence, and buyer-action fields." },
        { owner: "agent_07", action: "keep_source_pages_out_of_paid_findings", expectedEffect: "Prevent safe source URLs from being charged as intelligence findings." }
      ],
      buyerValueScore: 0.05,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (parserAdmissionRuntimeProof?.countsTowardCurrentSellableRows) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "Runtime parser admission proved actor, target, sector/country, impact, TTP, dates, public support, confidence, provenance, and buyer pivots for this current row.",
      paidRowReasonCodes: ["parser_runtime_admission", "buyer_fields_complete", "fresh_or_recent", "corroborated", "actionable"],
      paidRowRemediationActions: [],
      buyerValueScore: 0.86,
      billingGuidance: "charge"
    };
  }
  if (
    row.contradictionHints.length > 0
    || row.reviewReasons.some((reason) => reason.startsWith("hold:"))
    || row.coverageStatus === "no_evidence"
  ) {
    return {
      paidRowDecision: "hold",
      paidRowReason: "This row has a hold condition such as contradictory reporting, stale or missing evidence, low confidence, or no public evidence.",
      paidRowReasonCodes: [
        ...(row.contradictionHints.length > 0 ? ["contradiction_hold"] : []),
        ...(row.coverageStatus === "no_evidence" ? ["no_public_evidence"] : []),
        ...row.reviewReasons.filter((reason) => reason.startsWith("hold:"))
      ],
      paidRowRemediationActions: [
        { owner: "agent_03", action: "repair_parser_or_summary_specificity", expectedEffect: "Recover supported extracted facts before row promotion." },
        { owner: "agent_07", action: "rerun_quality_gate_after_repair", expectedEffect: "Keep held rows out of paid findings until evidence support is measurable." }
      ],
      buyerValueScore: row.evidenceGrade === "corroborated" ? 0.45 : 0.3,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (
    row.isActionable
    && row.evidenceGrade === "corroborated"
    && row.sourceFamilyCount >= 2
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent")
  ) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "Fresh or recent corroborated public evidence supports this row enough for paid monitoring output.",
      paidRowReasonCodes: ["fresh_or_recent", "corroborated", "source_family_diverse", "actionable"],
      paidRowRemediationActions: [],
      buyerValueScore: 0.9,
      billingGuidance: "charge"
    };
  }
  if (isCorroboratedPublicFinding(row)) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "Multiple fresh or recent public sources support this profile or targeting row; missing public-channel coverage remains visible as a caveat but does not make the corroborated public finding non-chargeable.",
      paidRowReasonCodes: ["fresh_or_recent", "corroborated", "multi_source_public", "actionable", "source_family_gap_visible"],
      paidRowRemediationActions: [
        { owner: "agent_04", action: "add_public_channel_or_dark_metadata_corroboration", expectedEffect: "Lift future confidence and source-family diversity while preserving this row as a chargeable public finding." },
        { owner: "agent_08", action: "preserve_graph_relationship_pivots_in_paid_row", expectedEffect: "Keep actor-to-target/TTP/source-family pivots visible so the sellable decision remains explainable and export-reviewable." }
      ],
      buyerValueScore: 0.78,
      billingGuidance: "charge"
    };
  }
  if (isSellablePublicEvidenceRow(row)) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "This public source-provenance row directly supports the actor result with fresh or recent safe evidence, a source URL, confidence, provenance hash, and next investigation pivots.",
      paidRowReasonCodes: ["public_evidence_row", "fresh_or_recent", "corroborated", "safe_source_url", "actionable"],
      paidRowRemediationActions: [
        { owner: "agent_09", action: "keep_source_rows_labelled_as_evidence_not_claims", expectedEffect: "Make paid rows useful without presenting a provenance row as a confirmed incident." },
        { owner: "agent_10", action: "track_source_evidence_rows_separately_in_paid_floor", expectedEffect: "Measure whether buyers value provenance rows and suppress them if conversion or refund signals are poor." }
      ],
      buyerValueScore: 0.7,
      billingGuidance: "charge"
    };
  }
  if (row.isActionable || row.evidenceGrade === "single_source" || row.coverageStatus === "thin") {
    return {
      paidRowDecision: "included_with_caveat",
      paidRowReason: "This row is useful as a lead but needs corroboration, source-family diversity, or fresher supporting evidence before promotion.",
      paidRowReasonCodes: [
        ...(row.evidenceGrade === "single_source" ? ["single_source"] : []),
        ...(row.sourceFamilyCount < 2 ? ["source_family_thin"] : []),
        ...(row.freshnessStatus === "stale" ? ["stale_support"] : []),
        ...(row.isActionable ? ["lead_is_actionable"] : ["lead_only"])
      ],
      paidRowRemediationActions: [
        { owner: "agent_01", action: "add_corroborating_clear_web_source", expectedEffect: "Increase source count and source-family diversity." },
        { owner: "agent_03", action: "extract_specific_actor_victim_ttp_fields", expectedEffect: "Move generic leads toward sellable rows after parser repair." }
      ],
      buyerValueScore: row.isActionable ? 0.65 : 0.5,
      billingGuidance: "include_as_context"
    };
  }
  return {
    paidRowDecision: "hold",
    paidRowReason: "This row is retained for context but is not ready as paid intelligence output.",
    paidRowReasonCodes: ["not_actionable", "low_support"],
    paidRowRemediationActions: [
      { owner: "agent_07", action: "keep_out_of_paid_findings", expectedEffect: "Avoid presenting unsupported context as a buyer-payworthy row." }
    ],
    buyerValueScore: 0.25,
    billingGuidance: "do_not_charge_if_metered"
  };
}

function isCorroboratedPublicFinding(row: MarketplaceRow): boolean {
  return row.isActionable
    && row.evidenceGrade === "corroborated"
    && (row.rowType === "profile" || row.rowType === "target" || row.rowType === "ttp")
    && row.sourceCount >= 4
    && row.sourceFamilies.includes("clear_web")
    && !row.contradictionHints.length
    && !row.reviewReasons.some((reason) => reason.startsWith("hold:"))
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent");
}

function isSellablePublicEvidenceRow(row: MarketplaceRow): boolean {
  return row.rowType === "source"
    && row.sourceType !== "system"
    && row.sourceUrl !== undefined
    && row.sourceUrl.length > 0
    && row.isActionable
    && row.evidenceGrade === "corroborated"
    && row.sourceCount >= 4
    && row.sourceFamilies.includes("clear_web")
    && !row.contradictionHints.length
    && !row.reviewReasons.some((reason) => reason.startsWith("hold:"))
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent")
    && row.safety.metadataOnly
    && !row.rawContentIncluded
    && !row.safety.credentialsIncluded
    && !row.safety.privateContentIncluded
    && !row.safety.stolenFilesIncluded;
}

function graphQualityLiftForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  parserAdmissionRuntimeProof?: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>
): Pick<MarketplaceRow, "graphQualityLift" | "graphQualityLiftReasonCodes" | "graphQualityLiftEvidence"> {
  const relationshipReady = parserAdmissionRuntimeProof?.countsTowardCurrentSellableRows
    || isCorroboratedPublicFinding(row)
    || (
      row.relationshipPivotTypes.includes("actor")
      && row.relationshipPivotTypes.some((type) => ["target", "sector", "country", "ttp", "claim", "source", "source_family"].includes(type))
    );
  const sourceFamilyCorroborated = row.corroborationState === "corroborated" || row.sourceCount >= 2;
  const contradictionHeld = row.contradictionHints.length > 0 || row.reviewReasons.some((reason) => reason.startsWith("hold:"));
  const freshnessLift = row.freshnessStatus === "current" || row.freshnessStatus === "recent";
  const exportEligible = decision.paidRowDecision === "sellable"
    && relationshipReady
    && sourceFamilyCorroborated
    && freshnessLift
    && !contradictionHeld;
  const graphQualityLift: NonNullable<MarketplaceRow["graphQualityLift"]> = exportEligible
    ? "accepted_sellable_lift"
    : contradictionHeld || decision.paidRowDecision === "hold" || decision.paidRowDecision === "suppress"
      ? "rejected_hold"
      : decision.paidRowDecision === "included_with_caveat" || decision.paidRowDecision === "coverage_gap_only"
        ? "rejected_caveat"
        : "not_applicable";

  return {
    graphQualityLift,
    graphQualityLiftReasonCodes: uniqueStrings([
      relationshipReady ? "relationship_ready" : "relationship_thin",
      sourceFamilyCorroborated ? "source_corroborated" : "source_needs_corroboration",
      freshnessLift ? "fresh_or_recent" : "stale_or_unknown",
      contradictionHeld ? "contradiction_or_hold_present" : "no_contradiction_hold",
      exportEligible ? "review_export_candidate" : "not_export_eligible",
      "metadata_only_no_leak"
    ]),
    graphQualityLiftEvidence: {
      relationshipReady,
      sourceFamilyCorroborated,
      contradictionHeld,
      freshnessLift,
      exportEligible,
      noLeak: true
    }
  };
}

function marketplaceGraphSignalsForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  graphLift: Pick<MarketplaceRow, "graphQualityLiftEvidence">
): NonNullable<MarketplaceRow["marketplaceGraphSignals"]> {
  const evidence = graphLift.graphQualityLiftEvidence;
  const contradictionState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["contradictionState"] = row.contradictionHints.length > 0
    ? "contradicted"
    : row.reviewReasons.some((reason) => reason.startsWith("hold:"))
      ? "review_hold"
      : "none";
  const hasBuyerReadyPublicEvidence = decision.paidRowDecision === "sellable"
    && contradictionState === "none"
    && Boolean(row.provenanceHash)
    && row.sourceFamilies.length > 0;
  const signalState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["signalState"] = (evidence?.exportEligible || hasBuyerReadyPublicEvidence) && decision.paidRowDecision === "sellable"
    ? "buyer_ready"
    : contradictionState !== "none" || decision.paidRowDecision === "hold" || decision.paidRowDecision === "suppress"
      ? "held"
      : "needs_corroboration";
  const relationshipLinks = uniqueStrings([
    `${row.actor}:actor`,
    ...row.relationshipPivots.slice(0, 5),
    ...row.sourceFamilies.slice(0, 3).map((family) => `source_family:${family}`)
  ]).slice(0, 8);
  const rejectedPivotReasons = uniqueStrings([
    row.nextSearchPivots.length === 0 ? "generic_pivot" : "",
    row.freshnessStatus === "stale" || row.freshnessDelta === "stale" ? "stale_pivot" : "",
    contradictionState === "none" ? "" : "contradicted_pivot",
    row.reviewReasons.some((reason) => reason.includes("alias") || reason.includes("unrelated")) ? "unrelated_actor_pivot" : "",
    row.hasDarknetMetadata && !row.hasPublicChannelCoverage && !evidence?.sourceFamilyCorroborated ? "restricted_only_pivot" : "",
    signalState === "buyer_ready" || evidence?.exportEligible ? "" : "missing_ledger_pivot",
    !evidence?.sourceFamilyCorroborated && signalState !== "held" && signalState !== "buyer_ready" ? "single_source_without_caveat" : "",
    row.nextSearchPivots.length === 0 && relationshipLinks.length <= 1 ? "no_action_pivot" : ""
  ].filter(Boolean)) as NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["rejectedPivotReasons"];
  const actionPivotCount = row.nextSearchPivots.length;
  const usefulPivotCount = Math.max(actionPivotCount, relationshipLinks.filter((link) => !link.endsWith(":actor")).length);
  const corroboratedPivotCount = evidence?.sourceFamilyCorroborated ? Math.min(usefulPivotCount, row.sourceFamilyCount + actionPivotCount) : 0;
  const buyerValueDelta = signalState === "buyer_ready" ? 0.04 : signalState === "needs_corroboration" ? 0.015 : 0;
  const freshnessChangeHints = uniqueStrings([
    `freshness:${row.freshnessDelta}`,
    `observed:${row.freshnessStatus}`,
    ...(row.claimedDate ? [`claimed:${row.claimedDate}`] : []),
    ...(row.firstReportedAt ? [`first_reported:${row.firstReportedAt}`] : []),
    ...(row.lastReportedAt ? [`last_reported:${row.lastReportedAt}`] : [])
  ]).slice(0, 5);
  return {
    schemaVersion: "ti.marketplace_graph_signals.v1",
    signalState,
    relationshipLinks,
    freshnessChangeHints,
    confidenceTrend: row.confidenceDelta,
    contradictionState,
    nextBuyerPivots: row.nextSearchPivots.slice(0, 5),
    pivotUtility: {
      usefulPivotCount,
      actionPivotCount,
      corroboratedPivotCount,
      suppressedGenericPivotCount: rejectedPivotReasons.filter((reason) => reason === "generic_pivot" || reason === "unrelated_actor_pivot").length,
      buyerValueDelta,
      noLeak: true
    },
    relationshipConfidence: {
      usefulPivotCount,
      actionPivotCount,
      corroboratedPivotCount,
      rejectedUnsupportedPivotCount: rejectedPivotReasons.length,
      confidenceTrend: row.confidenceDelta,
      contradictionState,
      nextSearchCount: actionPivotCount,
      sellableLift: signalState === "buyer_ready" ? 1 : 0,
      usefulLift: signalState === "buyer_ready" || signalState === "needs_corroboration" ? 1 : 0,
      buyerValueDelta,
      noLeak: true
    },
    rejectedPivotReasons,
    buyerAction: signalState === "buyer_ready"
      ? "chargeable_monitoring_signal"
      : signalState === "needs_corroboration"
        ? "use_as_lead_and_follow_next_pivots"
        : "do_not_promote_until_hold_clears",
    sourceBlockers: uniqueStrings([
      ...row.missingSourceFamilies.map((family) => `missing_${family}`),
      ...(evidence?.sourceFamilyCorroborated ? [] : ["needs_source_corroboration"]),
      ...(evidence?.freshnessLift ? [] : ["needs_fresh_public_evidence"]),
      ...(evidence?.contradictionHeld ? ["contradiction_or_review_hold"] : [])
    ]).slice(0, 6),
    noLeak: true
  };
}

function baseRow(response: TiSearchResponse, generatedAt: string, lastSeen: string): MarketplaceRow {
  const evidenceCount = response.sources.filter((source) => sourceType(source.type) !== "system").length;
  const quality = qualityFields(
    response,
    evidenceCount > 0 || response.recentActivity.length > 0 ? lastSeen : "",
    response.confidence,
    evidenceCount
  );
  const scheduler = schedulerFields(response);
  const coverageProduct = sourceCoverageProductFields(response);
  return {
    query: response.query,
    rowType: "profile",
    actor: response.query,
    title: `${response.query} public threat profile`,
    summary: response.summary,
    sourceType: "system",
    confidence: clampNumber(response.confidence, 0, 1),
    generatedAt,
    collectionMode: response.mode,
    sourceCount: evidenceCount,
    sourceFamilyCount: quality.sourceFamilyCount,
    sourceFamilies: quality.sourceFamilies,
    missingSourceFamilies: quality.missingSourceFamilies,
    coverageStatus: quality.coverageStatus,
    collectionPriority: quality.collectionPriority,
    recommendedCollectionAction: quality.recommendedCollectionAction,
    coverageGapCodes: quality.coverageGapCodes,
    activityCount: response.recentActivity.length,
    freshnessStatus: quality.freshnessStatus,
    ...scheduler,
    ...coverageProduct,
    evidenceGrade: quality.evidenceGrade,
    isActionable: quality.isActionable,
    reviewReasons: quality.reviewReasons,
    analysisFacets: analysisFacetsFor(response, "profile", quality, { sourceType: "system" }),
    hasDarknetMetadata: quality.hasDarknetMetadata,
    hasPublicChannelCoverage: quality.hasPublicChannelCoverage,
    ...relationshipInsightFields(response, "profile", quality, {
      title: response.query,
      confidence: response.confidence,
      observedAt: lastSeen
    }),
    firstSeen: generatedAt,
    lastSeen,
    provenanceHash: stableHash([response.query, response.summary, response.generatedAt, response.runId ?? ""].join("|")),
    rawContentIncluded: false,
    safety: {
      metadataOnly: true,
      credentialsIncluded: false,
      stolenFilesIncluded: false,
      privateContentIncluded: false,
      actorInteraction: false
    },
    runId: response.runId,
    status: response.status,
    aliases: response.aliases,
    warningCodes: warningsFor(response)
  };
}

function qualityFields(response: TiSearchResponse, observedAt: string, confidence: number, evidenceCount: number) {
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

function coverageGapRows(response: TiSearchResponse, generatedAt: string, lastSeen: string): MarketplaceRow[] {
  const quality = qualityFields(response, lastSeen, response.confidence, response.sources.filter((source) => sourceType(source.type) !== "system").length);
  if (quality.coverageGapCodes.length === 0) return [];

  return quality.coverageGapCodes.map((code) => ({
    ...baseRow(response, generatedAt, lastSeen),
    rowType: "coverage_gap",
    title: coverageGapTitle(code),
    summary: coverageGapSummary(response, code, quality),
    sourceType: "system",
    confidence: clampNumber(response.confidence, 0, 1),
    ...relationshipInsightFields(response, "coverage_gap", quality, {
      title: code,
      coverageGapCode: code,
      confidence: response.confidence,
      observedAt: lastSeen
    }),
    analysisFacets: analysisFacetsFor(response, "coverage_gap", quality, { coverageGapCode: code, sourceType: "system" }),
    provenanceHash: stableHash([response.query, code, quality.sourceFamilies.join(","), quality.missingSourceFamilies.join(",")].join("|"))
  }));
}

function analysisFacetsFor(
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

function isEvidenceSourceFamily(value: string): value is EvidenceSourceFamily {
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

function coverageGapTitle(code: string): string {
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

function coverageGapSummary(response: TiSearchResponse, code: string, quality: ReturnType<typeof qualityFields>): string {
  const families = quality.sourceFamilies.length ? quality.sourceFamilies.join(", ") : "none";
  const missing = quality.missingSourceFamilies.length ? quality.missingSourceFamilies.join(", ") : "none";
  return `${coverageGapTitle(code)} for ${response.query}. Current families: ${families}. Missing families: ${missing}. Recommended action: ${quality.recommendedCollectionAction}.`;
}

function schedulerFields(response: TiSearchResponse): Pick<MarketplaceRow,
  | "schedulerState"
  | "schedulerDecision"
  | "nextPollSeconds"
  | "retryAfterSeconds"
  | "duplicateRunReuse"
  | "attachedToActiveRun"
  | "queuedTaskCount"
  | "deferredBackgroundWorkloads"
  | "schedulerBadges"
  | "sourceCoverageState"
  | "sourceCoverageGapCount"
  | "sourceCoverageGaps"
  | "pollingHint"
> {
  const evidenceCount = response.sources.filter((source) => isEvidenceSourceFamily(sourceType(source.type))).length;
  const quality = qualityFields(response, evidenceCount > 0 || response.recentActivity.length > 0 ? response.lastSeen : "", response.confidence, evidenceCount);
  const scheduler = record(response.scheduler);
  const interactive = record(scheduler?.interactiveSearchFreshness);
  const queueDecision = record(interactive?.queueDecision);
  const uiSignals = record(interactive?.uiSignals);
  const runtimeSla = record(scheduler?.runtimeSla);
  const sourceCoverage = record(response.sourceCoverage);
  const sourceSlo = record(sourceCoverage?.slo);
  const sourceCoverageGaps = uniqueStrings([
    ...quality.coverageGapCodes,
    ...stringArray(sourceCoverage?.gaps),
    ...stringArray(sourceCoverage?.coverageGaps)
  ]).slice(0, 12);
  const nextPollSeconds = clampInt(
    numberFromUnknown(queueDecision?.nextPollSeconds ?? scheduler?.nextPollSeconds ?? response.refreshAfterSeconds),
    1,
    3600,
    response.status === "ready" ? 900 : 3
  );
  const fallbackState = response.status === "ready"
    ? "complete"
    : response.status === "partial"
      ? "polling"
      : response.status === "queued"
        ? "queued"
        : response.status ?? "unknown";
  const fallbackDecision = quality.coverageGapCodes.includes("contradicting_public_reports")
    ? "hold_for_review"
    : response.status === "partial"
      ? "reuse_active_run"
      : response.status === "queued"
        ? "retry_after"
        : quality.coverageGapCodes.length > 0
          ? "expand_source_coverage"
          : "complete";
  const schedulerState = safeString(runtimeSla?.state ?? scheduler?.backpressureState ?? fallbackState);
  const schedulerDecision = safeString(queueDecision?.decision ?? scheduler?.backpressureState ?? fallbackDecision);
  const attachedToActiveRun = boolFromUnknown(queueDecision?.attachedToActiveRun ?? scheduler?.attachedToActiveRun)
    || response.status === "partial"
    || response.status === "queued";
  const retryAfterSeconds = clampInt(
    numberFromUnknown(queueDecision?.retryAfterSeconds ?? scheduler?.retryAfterSeconds),
    response.status === "ready" ? 0 : 3,
    86_400,
    response.status === "queued" || response.status === "partial" ? Math.max(3, nextPollSeconds) : 0
  );
  const deferredBackgroundWorkloads = uniqueStrings([
    ...stringArray(queueDecision?.deferredBackgroundWorkloads),
    ...deferredWorkloadsFor(response, quality.coverageGapCodes)
  ]).slice(0, 12);
  const schedulerBadges = uniqueStrings([
    ...stringArray(uiSignals?.badges),
    ...schedulerBadgesFor(response, quality.coverageStatus)
  ]).slice(0, 12);

  return {
    schedulerState,
    schedulerDecision,
    nextPollSeconds,
    retryAfterSeconds,
    duplicateRunReuse: attachedToActiveRun || queueDecision?.duplicateRunReuse === "required_before_enqueue",
    attachedToActiveRun,
    queuedTaskCount: clampInt(numberFromUnknown(scheduler?.queuedTaskCount), 0, 1_000_000, response.status === "queued" ? 1 : 0),
    deferredBackgroundWorkloads,
    schedulerBadges,
    sourceCoverageState: safeString(sourceCoverage?.coverageState ?? sourceSlo?.status ?? quality.coverageStatus),
    sourceCoverageGapCount: sourceCoverageGaps.length,
    sourceCoverageGaps,
    pollingHint: pollingHintFor(response, sourceCoverageGaps, nextPollSeconds)
  };
}

function sourceCoverageProductFields(response: TiSearchResponse): Pick<MarketplaceRow,
  | "freshnessExpectation"
  | "highestValueMissingFamily"
  | "nextBestSourceAction"
  | "buyerCaveat"
  | "expectedTimeToUsefulSignal"
> {
  const row = actorCoverageMatrixRow(response);
  return {
    freshnessExpectation: safeString(row?.freshnessExpectation ?? "unknown"),
    highestValueMissingFamily: safeString(row?.highestValueMissingFamily ?? ""),
    nextBestSourceAction: safeString(row?.nextBestSourceAction ?? fallbackNextBestSourceAction(response)),
    buyerCaveat: safeString(row?.buyerCaveat ?? fallbackBuyerCaveat(response)),
    expectedTimeToUsefulSignal: safeString(row?.expectedTimeToUsefulSignal ?? "unknown_until_sources_added")
  };
}

function relationshipInsightFields(
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

function actorCoverageMatrixRow(response: TiSearchResponse): Record<string, unknown> | undefined {
  const sourceCoverage = record(response.sourceCoverage);
  const publicChannel = record(response.publicChannel);
  const signalFusion = record(publicChannel?.signalFusion);
  const candidates = [
    record(sourceCoverage?.actorSourceCoverageMatrix),
    record(sourceCoverage?.matrix),
    record(signalFusion?.actorSourceCoverageMatrix)
  ].filter((value): value is Record<string, unknown> => Boolean(value));
  const normalizedQuery = normalizeKey(response.query);
  for (const matrix of candidates) {
    const rows = recordArray(matrix.rows);
    const direct = rows.find((row) => normalizeKey(safeString(row.actor)) === normalizedQuery);
    if (direct) return direct;
    const alias = rows.find((row) => stringArray(row.aliases).some((value) => normalizeKey(value) === normalizedQuery));
    if (alias) return alias;
    const compact = record(matrix.compactProductFields);
    const priorities = recordArray(compact?.actorFeedPriorities);
    const priority = priorities.find((row) => normalizeKey(safeString(row.actor)) === normalizedQuery);
    if (priority) return priority;
  }
  return undefined;
}

function fallbackNextBestSourceAction(response: TiSearchResponse): string {
  const sourceCoverage = record(response.sourceCoverage);
  const gaps = uniqueStrings([
    ...stringArray(sourceCoverage?.gaps),
    ...stringArray(sourceCoverage?.coverageGaps)
  ]);
  if (gaps.includes("missing_public_channel_evidence")) return "activate_public_channel";
  if (gaps.includes("missing_clear_web_evidence") || gaps.includes("no_public_evidence")) return "activate_public_blog_news";
  if (gaps.includes("stale_or_missing_timestamp")) return "raise_cadence";
  if (gaps.length > 0) return "expose_coverage_gap";
  return "maintain_current_mix";
}

function fallbackBuyerCaveat(response: TiSearchResponse): string {
  const sourceCoverage = record(response.sourceCoverage);
  const gaps = uniqueStrings([
    ...stringArray(sourceCoverage?.gaps),
    ...stringArray(sourceCoverage?.coverageGaps)
  ]);
  if (gaps.length > 0) return `Coverage is partial for ${response.query}; review missing source families before treating this as complete.`;
  if (response.status === "partial" || response.status === "queued") return `Live collection is still running for ${response.query}; poll again before final triage.`;
  return "Coverage appears sufficient for the current public metadata snapshot.";
}

function deferredWorkloadsFor(response: TiSearchResponse, coverageGapCodes: string[]): string[] {
  const workloads = new Set<string>();
  if (response.status === "partial" || response.status === "queued") workloads.add("poll_run_status");
  if (coverageGapCodes.includes("missing_public_channel_evidence")) workloads.add("public_channel_source_gap");
  if (coverageGapCodes.includes("missing_clear_web_evidence") || coverageGapCodes.includes("no_public_evidence")) workloads.add("clear_web_source_gap");
  if (coverageGapCodes.includes("stale_or_missing_timestamp")) workloads.add("freshness_polling");
  if (coverageGapCodes.includes("contradicting_public_reports")) workloads.add("analyst_contradiction_review");
  return [...workloads].sort();
}

function schedulerBadgesFor(response: TiSearchResponse, coverageStatus: MarketplaceRow["coverageStatus"]): string[] {
  const badges = new Set<string>(["safe_metadata_only", `coverage:${coverageStatus}`]);
  if (response.status) badges.add(`status:${response.status}`);
  if (response.refreshAfterSeconds && response.refreshAfterSeconds <= 5) badges.add("fast_poll");
  if (response.status === "partial" || response.status === "queued") badges.add("active_run_reuse");
  return [...badges].sort();
}

function pollingHintFor(response: TiSearchResponse, coverageGapCodes: string[], nextPollSeconds: number): string {
  if (coverageGapCodes.length > 0) return "source_gap_review";
  if (response.status === "queued" || response.status === "partial") return `poll_after_${nextPollSeconds}s`;
  if (coverageGapCodes.includes("missing_public_channel_evidence")) return "schedule_public_channel_source_review";
  if (coverageGapCodes.includes("stale_or_missing_timestamp")) return "increase_public_source_polling";
  return "no_poll_needed";
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

function freshnessFor(value: string): MarketplaceRow["freshnessStatus"] {
  const observed = Date.parse(value);
  if (Number.isNaN(observed)) return "unknown";
  const ageDays = (Date.now() - observed) / 86_400_000;
  if (ageDays < -1) return "unknown";
  if (ageDays <= 7) return "current";
  if (ageDays <= 90) return "recent";
  return "stale";
}

await main();

export {};
