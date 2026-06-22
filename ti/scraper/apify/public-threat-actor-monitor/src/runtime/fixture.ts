import type { TiSearchResponse } from "../types.ts";

export function retargetFixtureResponse(response: TiSearchResponse, query: string): TiSearchResponse {
  const sourceQuery = response.query || "APT42";
  if (!query || query === sourceQuery) return response;
  return JSON.parse(JSON.stringify(response).replaceAll(sourceQuery, query)) as TiSearchResponse;
}
