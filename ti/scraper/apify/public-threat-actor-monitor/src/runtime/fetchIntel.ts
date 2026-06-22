import type { TiSearchResponse } from "../types.ts";
import { fetchBatch } from "./fetchBatch.ts";
import { retargetFixtureResponse } from "./fixture.ts";
import { fetchPublicNewsFallback } from "./newsFallback.ts";
import { fetchRansomwareLiveFallback } from "./ransomwareLiveFallback.ts";
export async function fetchThreatIntel(apiBaseUrl: string, query: string): Promise<TiSearchResponse> {
  if (process.env.TI_ACTOR_FIXTURE_PATH) {
    const fixture = await Bun.file(process.env.TI_ACTOR_FIXTURE_PATH).json() as TiSearchResponse;
    return retargetFixtureResponse(fixture, query);
  }
  const ransomwareFeed = await fetchRansomwareLiveFallback(query);
  if (ransomwareFeed) return ransomwareFeed;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchOnce(apiBaseUrl, query).catch(() => undefined);
    if (response && hasUsefulPayload(response)) return response;
    await Bun.sleep(1_000 + attempt * 1_500);
  }
  return await fetchPublicNewsFallback(query) ?? unavailableResponse(query);
}
export async function fetchThreatIntelBatch(apiBaseUrl: string, queries: string[]): Promise<TiSearchResponse[]> {
  if (process.env.TI_ACTOR_FIXTURE_PATH) return Promise.all(queries.map((query) => fetchThreatIntel(apiBaseUrl, query)));
  const batch = process.env.TI_ACTOR_USE_BATCH === "true" ? await retryBatch(apiBaseUrl, queries) : undefined;
  if (batch?.length === queries.length) return batch;
  const results: TiSearchResponse[] = [];
  for (const query of queries) results.push(await fetchThreatIntel(apiBaseUrl, query));
  return results;
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
function hasUsefulPayload(response: TiSearchResponse): boolean {
  return response.recentActivity.length > 0 || response.sources.length > 0 || response.mode !== "live_api_unavailable";
}
async function retryBatch(apiBaseUrl: string, queries: string[]): Promise<TiSearchResponse[] | undefined> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const batch = await fetchBatch(apiBaseUrl, queries).catch(() => undefined);
    if (batch?.length === queries.length) return batch;
    await Bun.sleep(750 + attempt * 1_250);
  }
  return undefined;
}
function unavailableResponse(query: string): TiSearchResponse {
  const generatedAt = new Date().toISOString();
  return { query, generatedAt, mode: "live_api_unavailable", status: "searching", summary: "searching", confidence: 0, lastSeen: generatedAt, aliases: [], recentActivity: [], targets: [], ttps: [], datasets: [], sources: [], notes: ["transient_api_unavailable"] };
}
