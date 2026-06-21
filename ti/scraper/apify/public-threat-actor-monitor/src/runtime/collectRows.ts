import type { MarketplaceRow, TiSearchResponse } from "../types.ts";
import type { NormalizedInput } from "./input.ts";
import type { NewsFallbackBudget } from "./fallbackBudget.ts";
import { fetchPublicNewsFallback } from "./newsFallback.ts";
import { needsNewsFallback, outputRowsFor } from "./rows.ts";

export async function collectRowsForResponses(
  responses: TiSearchResponse[],
  input: NormalizedInput,
  budget: NewsFallbackBudget
): Promise<MarketplaceRow[]> {
  const rows: MarketplaceRow[] = [];
  for (let index = 0; index < responses.length; index += 10) {
    const collected = await Promise.all(responses.slice(index, index + 10)
      .map((response) => rowsForResponse(response, input, budget)));
    rows.push(...collected.flat());
  }
  return rows;
}

async function rowsForResponse(
  response: TiSearchResponse,
  input: NormalizedInput,
  budget: NewsFallbackBudget
): Promise<MarketplaceRow[]> {
  let rows = outputRowsFor(response, input);
  if (needsNewsFallback(rows) && budget.tryUse()) {
    const fallback = await fetchPublicNewsFallback(response.query);
    if (fallback) {
      rows = outputRowsFor(fallback, input);
      budget.markUsed();
    }
  }
  return rows.slice(0, input.maxRowsPerQuery);
}
