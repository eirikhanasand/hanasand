import type { MarketplaceRow } from "./types.ts";
import { dailyCollectionRunForRows, monetizationForRows } from "./outputQuality.ts";
import { writeOutputs } from "./outputWrite.ts";
import { fetchThreatIntelBatch, normalizeInput, readInput } from "./actorRuntime.ts";
import { collectRowsForResponses } from "./runtime/collectRows.ts";
import { createNewsFallbackBudget } from "./runtime/fallbackBudget.ts";

async function main() {
  const input = normalizeInput(await readInput());
  const rows: MarketplaceRow[] = [];
  const newsFallbackBudget = createNewsFallbackBudget(input.queries.length);

  for (let index = 0; index < input.queries.length; index += 50) {
    const batch = input.queries.slice(index, index + 50);
    const responses = await fetchThreatIntelBatch(input.apiBaseUrl, batch);
    rows.push(...await collectRowsForResponses(responses, input, newsFallbackBudget));
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
