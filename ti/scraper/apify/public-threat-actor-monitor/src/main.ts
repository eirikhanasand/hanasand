import type { MarketplaceRow } from "./types.ts";
import { dailyCollectionRunForRows, monetizationForRows } from "./outputQuality.ts";
import { writeOutputs } from "./outputWrite.ts";
import { fetchThreatIntelBatch, normalizeInput, readInput } from "./actorRuntime.ts";
import type { NormalizedInput } from "./runtime/input.ts";
import { collectRowsForResponses } from "./runtime/collectRows.ts";
import { createNewsFallbackBudget } from "./runtime/fallbackBudget.ts";
import { fetchCisaKevResponses } from "./runtime/cisaKev.ts";
import { fetchDlsMonitorNovelResponses } from "./runtime/dlsMonitor.ts";
import { fetchNvdRecentResponses } from "./runtime/nvdRecent.ts";
import { fetchRansomLookPostIndexResponses, fetchRansomLookRecentResponses, fetchRansomLookRssResponses, fetchRansomLookSearchResponses } from "./runtime/ransomLookRecent.ts";
import { fetchRansomwareLiveVictimsJsonResponses } from "./runtime/ransomwareLiveVictimsJson.ts";

async function main() {
  const input = normalizeInput(await readInput());
  const rows: MarketplaceRow[] = [];
  const newsFallbackBudget = createNewsFallbackBudget(input.queries.length);
  const watchlistOnly = input.onlyWatchlistMatches && input.watchlistTerms.length > 0;
  const ransomLookResponses = process.env.TI_ACTOR_FIXTURE_PATH ? undefined : await fetchRansomLookRecentResponses();
  const ransomLookRssResponses = process.env.TI_ACTOR_FIXTURE_PATH ? undefined : await fetchRansomLookRssResponses();
  const ransomLookPostIndexResponses = process.env.TI_ACTOR_FIXTURE_PATH ? undefined : await fetchRansomLookPostIndexResponses();
  const ransomLookSearchResponses = process.env.TI_ACTOR_FIXTURE_PATH ? undefined : await fetchRansomLookSearchResponses(input.queries, input.runMode === "preview" ? 10 : 50);
  const victimsJsonResponses = process.env.TI_ACTOR_FIXTURE_PATH ? undefined : await fetchRansomwareLiveVictimsJsonResponses();
  const dlsMonitorResponses = process.env.TI_ACTOR_FIXTURE_PATH ? undefined : await fetchDlsMonitorNovelResponses([
    ...(ransomLookResponses ?? []),
    ...(ransomLookRssResponses ?? []),
    ...(ransomLookPostIndexResponses ?? []),
    ...(ransomLookSearchResponses ?? []),
    ...(victimsJsonResponses ?? [])
  ]);
  const cisaKevResponses = process.env.TI_ACTOR_FIXTURE_PATH || watchlistOnly ? undefined : await fetchCisaKevResponses(input.runMode === "preview" ? 250 : 5_000);
  const nvdRecentResponses = process.env.TI_ACTOR_FIXTURE_PATH || watchlistOnly ? undefined : await fetchNvdRecentResponses(input.runMode === "preview"
    ? { publishedLimit: 250, modifiedLimit: 250 }
    : {});

  if (ransomLookResponses?.length || ransomLookRssResponses?.length || ransomLookPostIndexResponses?.length || ransomLookSearchResponses?.length || victimsJsonResponses?.length || dlsMonitorResponses?.length) {
    if (ransomLookResponses?.length) rows.push(...await collectRowsForResponses(ransomLookResponses, input, newsFallbackBudget));
    if (ransomLookRssResponses?.length) rows.push(...await collectRowsForResponses(ransomLookRssResponses, input, newsFallbackBudget));
    if (ransomLookSearchResponses?.length) rows.push(...await collectRowsForResponses(ransomLookSearchResponses, input, newsFallbackBudget));
    if (ransomLookPostIndexResponses?.length) rows.push(...await collectRowsForResponses(ransomLookPostIndexResponses, input, newsFallbackBudget));
    if (victimsJsonResponses?.length) rows.push(...await collectRowsForResponses(victimsJsonResponses, input, newsFallbackBudget));
    if (dlsMonitorResponses?.length) rows.push(...await collectRowsForResponses(dlsMonitorResponses, input, newsFallbackBudget));
    if (cisaKevResponses?.length) rows.push(...await collectRowsForResponses(cisaKevResponses, input, newsFallbackBudget));
    if (nvdRecentResponses?.length) rows.push(...await collectRowsForResponses(nvdRecentResponses, input, newsFallbackBudget));
  } else {
    for (let index = 0; index < input.queries.length; index += 50) {
      const batch = input.queries.slice(index, index + 50);
      const responses = await fetchThreatIntelBatch(input.apiBaseUrl, batch);
      rows.push(...await collectRowsForResponses(responses, input, newsFallbackBudget));
    }
  }

  const outputRows = buyerOrderedRows(applyWatchlist(rows, input), input).slice(0, input.maxTotalRows);
  const monetizationSummary = monetizationForRows(outputRows);
  const dailyCollectionRun = dailyCollectionRunForRows(outputRows);
  await writeOutputs(outputRows, monetizationSummary);
  console.log(JSON.stringify({
    ok: true,
    rowCount: outputRows.length,
    queries: input.queries,
    outputContract: "safe_metadata_only.v1",
    billingMode: monetizationSummary.billingMode,
    chargeEvents: monetizationSummary.eventNames,
    datasetItemEventsExpected: monetizationSummary.datasetItemCount,
    liveDataRealRowCount: monetizationSummary.liveDataRealRowCount,
    sellableLiveDataRealRowCount: monetizationSummary.sellableLiveDataRealRowCount,
    distinctHostedSourceFindingCount: monetizationSummary.distinctHostedSourceFindingCount,
    publicNewsFallbackAttempts: newsFallbackBudget.attempts,
    publicNewsFallbacksUsed: newsFallbackBudget.used,
    publicNewsFallbackLimit: newsFallbackBudget.limit,
    dailyCollectionRun
  }));
}

await main();

export {};

function buyerOrderedRows(rows: MarketplaceRow[], input: NormalizedInput): MarketplaceRow[] {
  const ordered = [...rows].sort((left, right) => scoreRow(right) - scoreRow(left));
  const seen = new Set<string>();
  return ordered.filter((row) => {
    if (input.onlyWatchlistMatches && input.watchlistTerms.length > 0 && watchlistMatchTerms(row, input.watchlistTerms).length === 0) return false;
    const key = duplicateKey(row);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreRow(row: MarketplaceRow): number {
  const timestamp = Date.parse(row.lastSeen ?? row.claimedDate ?? row.generatedAt ?? "");
  return [
    row.paidRowDecision === "sellable" ? 100 : 0,
    row.billingGuidance === "charge" ? 50 : 0,
    row.rowType === "activity" ? 30 : 0,
    row.freshnessStatus === "current" ? 20 : row.freshnessStatus === "recent" ? 10 : 0,
    row.liveDataReal ? 10 : 0,
    row.claimedDataSummary ? 8 : 0,
    row.actorPostUrl ? 4 : 0,
    row.victimWebsite ? 2 : 0,
    Math.round((row.buyerValueScore ?? 0) * 10),
    Number.isFinite(timestamp) ? timestamp / 10_000_000_000 : 0
  ].reduce((sum, value) => sum + value, 0);
}

function applyWatchlist(rows: MarketplaceRow[], input: NormalizedInput): MarketplaceRow[] {
  if (input.watchlistTerms.length === 0) return rows;
  return rows.map((row) => {
    const matches = watchlistMatchTerms(row, input.watchlistTerms);
    if (matches.length === 0) return row;
    return {
      ...row,
      matchedSearchTerm: row.matchedSearchTerm ?? matches[0],
      buyerValueScore: Math.min(1, (row.buyerValueScore ?? 0) + 0.06),
      keyPivots: mergePivots(row.keyPivots, matches),
      buyerSearchCard: row.buyerSearchCard
        ? {
            ...row.buyerSearchCard,
            nextSearches: mergePivots(row.buyerSearchCard.nextSearches, matches)
          }
        : row.buyerSearchCard,
      analysisFacets: [...new Set([...row.analysisFacets, "watchlist_match"])]
    };
  });
}

function mergePivots(values: string[] | undefined, additions: string[]): string[] {
  return [...new Set([...(values ?? []), ...additions])].slice(0, 8);
}

function watchlistMatchTerms(row: MarketplaceRow, terms: string[]): string[] {
  const haystack = [
    row.victimName,
    row.victimWebsite,
    row.matchedSearchTerm,
    row.title,
    row.summary,
    row.sourceName,
    row.claimedDataSummary,
    ...(row.keyPivots ?? []),
    ...(row.buyerSearchCard?.victimsTargets ?? [])
  ].filter(Boolean).join(" \n ").toLowerCase();
  return terms
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .filter((term) => haystack.includes(term.toLowerCase()));
}

function duplicateKey(row: MarketplaceRow): string | undefined {
  if (row.claimType === "victim_claim" && row.victimName) {
    return [
      "victim",
      normalizeKey(row.actor),
      normalizeKey(row.victimName),
      dateKey(row.claimedDate ?? row.lastSeen)
    ].join("|");
  }
  if (row.claimType === "vulnerability_disclosure" && row.attackId) {
    return ["vulnerability", normalizeKey(row.attackId), dateKey(row.claimedDate ?? row.lastSeen)].join("|");
  }
  return undefined;
}

function normalizeKey(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
}

function dateKey(value: string | undefined): string {
  return Number.isFinite(Date.parse(value ?? "")) ? new Date(value ?? "").toISOString().slice(0, 10) : "";
}
