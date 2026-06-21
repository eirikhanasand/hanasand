import type { TiSearchResponse } from "../types.ts";

export async function fetchBatch(apiBaseUrl: string, queries: string[]): Promise<TiSearchResponse[] | undefined> {
  const response = await fetch(`${apiBaseUrl}/batch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ queries })
  });
  if (!response.ok) return undefined;
  const body = await response.json() as { results?: TiSearchResponse[] };
  return body.results;
}
