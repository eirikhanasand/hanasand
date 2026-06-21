import type { ActorInput, MarketplaceRow, PaidRowDecision, TiSearchResponse } from "./types.ts";
import { DEFAULT_API_BASE, DEFAULT_QUERIES, MAX_QUERIES_PER_RUN } from "./constants.ts";
import { apifyApiBase, apifyHeaders, clampInt, uniqueStrings } from "./utils.ts";

export type NormalizedInput = Required<ActorInput> & { queries: string[]; apiBaseUrl: string };

export function normalizeInput(input: ActorInput): NormalizedInput {
  const queries = uniqueStrings([
    ...(input.queries ?? []),
    ...(input.query ? [input.query] : [])
  ]).slice(0, MAX_QUERIES_PER_RUN);

  return {
    query: input.query ?? "",
    queries: queries.length ? queries : DEFAULT_QUERIES,
    maxRowsPerQuery: clampInt(input.maxRowsPerQuery, 1, 100, 25),
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

export function filterOutputRows(rows: MarketplaceRow[], input: NormalizedInput): MarketplaceRow[] {
  return rows.filter((row) => {
    if (!input.includeCoverageGaps && row.paidRowDecision === "coverage_gap_only") return false;
    if (!input.includeHeldRows && (row.paidRowDecision === "hold" || row.paidRowDecision === "suppress")) return false;
    return true;
  });
}

export function prioritizeDailyCollectionRows(rows: MarketplaceRow[]): MarketplaceRow[] {
  const decisionRank: Record<PaidRowDecision, number> = {
    sellable: 0,
    included_with_caveat: 1,
    coverage_gap_only: 2,
    hold: 3,
    suppress: 4
  };
  const freshnessRank: Record<MarketplaceRow["freshnessStatus"], number> = {
    current: 0,
    recent: 1,
    unknown: 2,
    stale: 3
  };
  const rowTypeRank: Record<MarketplaceRow["rowType"], number> = {
    activity: 0,
    target: 1,
    ttp: 2,
    profile: 3,
    source: 4,
    dataset: 5,
    coverage_gap: 6
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftDecision = left.row.paidRowDecision ?? "hold";
      const rightDecision = right.row.paidRowDecision ?? "hold";
      return decisionRank[leftDecision] - decisionRank[rightDecision]
        || freshnessRank[left.row.freshnessStatus] - freshnessRank[right.row.freshnessStatus]
        || rowTypeRank[left.row.rowType] - rowTypeRank[right.row.rowType]
        || (right.row.buyerValueScore ?? 0) - (left.row.buyerValueScore ?? 0)
        || left.index - right.index;
    })
    .map((entry) => entry.row);
}

export async function readInput(): Promise<ActorInput> {
  const remoteInput = await readRemoteApifyInput();
  if (remoteInput) return remoteInput;

  const candidates = [
    process.env.APIFY_INPUT_KEY_VALUE_STORE_DIR ? `${process.env.APIFY_INPUT_KEY_VALUE_STORE_DIR}/INPUT.json` : "",
    process.env.APIFY_LOCAL_STORAGE_DIR ? `${process.env.APIFY_LOCAL_STORAGE_DIR}/key_value_stores/default/INPUT.json` : "",
    process.env.TI_ACTOR_INPUT_PATH ?? "",
    "input.json"
  ].filter(Boolean);

  for (const candidate of candidates) {
    const file = Bun.file(candidate);
    if (await file.exists()) {
      return await file.json() as ActorInput;
    }
  }

  if (process.env.TI_ACTOR_INPUT_JSON) {
    return JSON.parse(process.env.TI_ACTOR_INPUT_JSON) as ActorInput;
  }

  return {};
}

export async function readRemoteApifyInput(): Promise<ActorInput | undefined> {
  const storeId = process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID;
  const inputKey = process.env.APIFY_INPUT_KEY ?? "INPUT";
  if (!storeId || !process.env.APIFY_TOKEN) return undefined;

  const response = await fetch(`${apifyApiBase()}/v2/key-value-stores/${storeId}/records/${inputKey}`, {
    headers: apifyHeaders()
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Apify input fetch returned ${response.status}`);
  return await response.json() as ActorInput;
}

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
    if (!response.ok) {
      throw new Error(`TI API returned ${response.status} for ${query}`);
    }
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
