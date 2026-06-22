import type { ActorInput } from "../types.ts";
import { DEFAULT_API_BASE, DEFAULT_MAX_ROWS_PER_QUERY, DEFAULT_RUNTIME_QUERIES, MAX_QUERIES_PER_RUN } from "../constants.ts";
import { clampInt, uniqueStrings } from "../utils.ts";
import { readRemoteApifyInput } from "./remoteInput.ts";

export type NormalizedInput = Required<ActorInput> & { queries: string[]; apiBaseUrl: string };

export function normalizeInput(input: ActorInput): NormalizedInput {
  const queries = uniqueStrings([...(input.queries ?? []), ...(input.query ? [input.query] : [])]).slice(0, MAX_QUERIES_PER_RUN);
  const watchlistTerms = uniqueStrings(input.watchlistTerms ?? []).slice(0, MAX_QUERIES_PER_RUN);
  const runMode = input.runMode === "full" ? "full" : "preview";
  const defaultMaxRowsPerQuery = runMode === "full" ? DEFAULT_MAX_ROWS_PER_QUERY : 250;
  const defaultMaxTotalRows = runMode === "full" ? 250_000 : 500;
  return {
    query: input.query ?? "",
    queries: queries.length ? queries : DEFAULT_RUNTIME_QUERIES,
    watchlistTerms,
    onlyWatchlistMatches: input.onlyWatchlistMatches ?? false,
    runMode,
    maxRowsPerQuery: clampInt(input.maxRowsPerQuery, 1, DEFAULT_MAX_ROWS_PER_QUERY, defaultMaxRowsPerQuery),
    maxTotalRows: clampInt(input.maxTotalRows, 1, 250_000, defaultMaxTotalRows),
    includeActivity: input.includeActivity ?? true,
    includeTargets: input.includeTargets ?? runMode === "full",
    includeTtps: input.includeTtps ?? runMode === "full",
    includeSources: input.includeSources ?? false,
    includeDatasets: input.includeDatasets ?? false,
    includeCoverageGaps: input.includeCoverageGaps ?? false,
    includeHeldRows: input.includeHeldRows ?? false,
    apiBaseUrl: (process.env.TI_PUBLIC_API_BASE ?? DEFAULT_API_BASE).replace(/\/$/, "")
  };
}

export async function readInput(): Promise<ActorInput> {
  const remoteInput = await readRemoteApifyInput();
  if (remoteInput) return remoteInput;
  for (const candidate of inputCandidates()) {
    const file = Bun.file(candidate);
    if (await file.exists()) return await file.json() as ActorInput;
  }
  if (process.env.TI_ACTOR_INPUT_JSON) return JSON.parse(process.env.TI_ACTOR_INPUT_JSON) as ActorInput;
  return {};
}

function inputCandidates(): string[] {
  return [
    process.env.APIFY_INPUT_KEY_VALUE_STORE_DIR ? `${process.env.APIFY_INPUT_KEY_VALUE_STORE_DIR}/INPUT.json` : "",
    process.env.APIFY_LOCAL_STORAGE_DIR ? `${process.env.APIFY_LOCAL_STORAGE_DIR}/key_value_stores/default/INPUT.json` : "",
    process.env.TI_ACTOR_INPUT_PATH ?? "",
    "input.json"
  ].filter(Boolean);
}
