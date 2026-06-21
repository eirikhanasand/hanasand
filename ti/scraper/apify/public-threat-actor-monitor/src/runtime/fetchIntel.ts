import type { TiSearchResponse } from "../types.ts";

export async function fetchThreatIntel(apiBaseUrl: string, query: string): Promise<TiSearchResponse> {
  if (process.env.TI_ACTOR_FIXTURE_PATH) {
    const fixture = await Bun.file(process.env.TI_ACTOR_FIXTURE_PATH).json() as TiSearchResponse;
    return retargetFixtureResponse(fixture, query);
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetchOnce(apiBaseUrl, query).catch(() => undefined);
    if (response) return response;
    await Bun.sleep(1_500 + attempt * 1_500);
  }
  return unavailableResponse(query);
}

async function fetchOnce(apiBaseUrl: string, query: string): Promise<TiSearchResponse> {
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

function unavailableResponse(query: string): TiSearchResponse {
  const generatedAt = new Date().toISOString();
  return {
    query, generatedAt, mode: "live_api_unavailable", status: "searching",
    summary: "searching", confidence: 0, lastSeen: generatedAt, aliases: [],
    recentActivity: [], targets: [], ttps: [], datasets: [], sources: [],
    notes: ["transient_api_unavailable"]
  };
}

export function retargetFixtureResponse(response: TiSearchResponse, query: string): TiSearchResponse {
  const sourceQuery = response.query || "APT42";
  if (!query || query === sourceQuery) return response;
  return JSON.parse(JSON.stringify(response).replaceAll(sourceQuery, query)) as TiSearchResponse;
}
