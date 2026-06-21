import { buildHostedDefaultParserLift } from "./hostedDefaultParserLift.ts";

import type { MarketplaceRow } from "./types.ts";
import { dailyCollectionRunForRows, monetizationForRows } from "./outputQuality.ts";
import { normalizeResponse } from "./responseRows.ts";
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
    liveDataRealRowCount: monetizationSummary.liveDataRealRowCount,
    sellableLiveDataRealRowCount: monetizationSummary.sellableLiveDataRealRowCount,
    distinctHostedSourceFindingCount: monetizationSummary.distinctHostedSourceFindingCount,
    dailyCollectionRun
  }));
}

await main();

export {};
