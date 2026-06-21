import type { DarkwebIndexContractDto, DarkwebIndexNetwork, DarkwebIndexRecord, DarkwebIndexSearchDto } from "./darkwebIndexTypes.ts";
import { rowsFromRuntime } from "./darkwebIndexFixtures.ts";
import { buyerRow, noLeak } from "./darkwebIndexHelpers.ts";

export function searchDarkwebIndex(input: { records?: readonly DarkwebIndexRecord[]; sources?: any[]; captures?: any[]; q?: string; query?: string; network?: DarkwebIndexNetwork; limit?: number; cursor?: string }): DarkwebIndexSearchDto {
  const rows = input.records ? [...input.records] : rowsFromRuntime(input);
  const query = (input.q ?? input.query ?? "").toLowerCase();
  const offset = Number(input.cursor ?? 0) || 0;
  const filtered = rows.filter((r) => (!query || JSON.stringify(buyerRow(r)).toLowerCase().includes(query)) && (!input.network || r.network === input.network));
  const page = filtered.slice(offset, offset + (input.limit ?? 50)).map(buyerRow);
  return { query, network: input.network, count: filtered.length, rows: page, nextCursor: offset + page.length < filtered.length ? String(offset + page.length) : undefined, noLeakSerialization: noLeak() };
}

export function darkwebIndexContract(): DarkwebIndexContractDto {
  return {
    routes: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"],
    searchableFields: ["title", "safeSummary", "actorHints", "victimHints", "datasetHints", "sectorHints", "countryHints"],
    safety: { metadataOnly: true, isolatedCollectorOnly: true, noPayloadFollowing: true, noCredentialDownloads: true, noPrivateAccess: true, noCaptchaSolving: true, noThreatActorInteraction: true, noRawUnsafeUrlPublicOutput: true },
    sourceIngest: { sourceTypes: ["directory", "seed_list", "analyst_import", "public_report", "safe_search_result", "internal_discovery"], approvalStates: ["approved_metadata_only", "pending_legal_review", "disabled_kill_switch", "blocked_unsafe"], dedupeKeys: ["rawUrlHash", "sourceHash", "safeLocatorHash"], runtimeMode: "metadata_only" }
  };
}
