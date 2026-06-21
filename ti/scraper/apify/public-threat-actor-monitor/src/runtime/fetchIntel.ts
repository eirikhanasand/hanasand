import type { TiSearchResponse } from "../types.ts";

export async function fetchThreatIntel(apiBaseUrl: string, query: string): Promise<TiSearchResponse> {
  if (process.env.TI_ACTOR_FIXTURE_PATH) {
    const fixture = await Bun.file(process.env.TI_ACTOR_FIXTURE_PATH).json() as TiSearchResponse;
    return retargetFixtureResponse(fixture, query);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(apiBaseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`TI API returned ${response.status} for ${query}`);
    return await response.json() as TiSearchResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export function retargetFixtureResponse(response: TiSearchResponse, query: string): TiSearchResponse {
  const sourceQuery = response.query || "APT42";
  if (!query || query === sourceQuery) return response;
  return JSON.parse(JSON.stringify(response).replaceAll(sourceQuery, query)) as TiSearchResponse;
}
