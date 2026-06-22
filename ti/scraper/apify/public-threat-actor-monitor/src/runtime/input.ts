import type { ActorInput } from "../types.ts";
import { DEFAULT_API_BASE, DEFAULT_MAX_ROWS_PER_QUERY, DEFAULT_RUNTIME_QUERIES, MAX_QUERIES_PER_RUN } from "../constants.ts";
import { clampInt, uniqueStrings } from "../utils.ts";
import { readRemoteApifyInput } from "./remoteInput.ts";

export type NormalizedInput = Required<ActorInput> & { queries: string[]; apiBaseUrl: string };

export function normalizeInput(input: ActorInput): NormalizedInput {
  const queries = uniqueStrings([...(input.queries ?? []), ...(input.query ? [input.query] : [])]).slice(0, MAX_QUERIES_PER_RUN);
  return {
    query: input.query ?? "",
    queries: queries.length ? queries : DEFAULT_RUNTIME_QUERIES,
    maxRowsPerQuery: clampInt(input.maxRowsPerQuery, 1, 500, DEFAULT_MAX_ROWS_PER_QUERY),
    includeActivity: input.includeActivity ?? true,
    includeTargets: input.includeTargets ?? true,
    includeTtps: input.includeTtps ?? true,
    includeSources: input.includeSources ?? true,
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
