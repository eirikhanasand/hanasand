import type { MarketplaceRow } from "./types.ts";
import { dailyCollectionRunForRows, monetizationForRows } from "./outputQuality.ts";
import { fetchPublicNewsFallback } from "./runtime/newsFallback.ts";
import { writeOutputs } from "./outputWrite.ts";
import { fetchThreatIntel, needsNewsFallback, normalizeInput, outputRowsFor, readInput } from "./actorRuntime.ts";

async function main() {
  const input = normalizeInput(await readInput());
  const rows: MarketplaceRow[] = [];
  let newsFallbackAttempts = 0;
  let newsFallbacksUsed = 0;

  for (let index = 0; index < input.queries.length; index += 5) {
    const batch = input.queries.slice(index, index + 5);
    const responses = await Promise.all(batch.map((query) => fetchThreatIntel(input.apiBaseUrl, query)));
    for (const response of responses) {
      let outputRows = outputRowsFor(response, input);
      if (needsNewsFallback(outputRows) && newsFallbackAttempts < 25) {
        newsFallbackAttempts += 1;
        const fallback = await fetchPublicNewsFallback(response.query);
        if (fallback) {
          outputRows = outputRowsFor(fallback, input);
          newsFallbacksUsed += 1;
        }
      }
      rows.push(...outputRows.slice(0, input.maxRowsPerQuery));
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
    liveDataRealRowCount: monetizationSummary.liveDataRealRowCount,
    sellableLiveDataRealRowCount: monetizationSummary.sellableLiveDataRealRowCount,
    distinctHostedSourceFindingCount: monetizationSummary.distinctHostedSourceFindingCount,
    publicNewsFallbackAttempts: newsFallbackAttempts,
    publicNewsFallbacksUsed: newsFallbacksUsed,
    dailyCollectionRun
  }));
}

await main();

export {};
