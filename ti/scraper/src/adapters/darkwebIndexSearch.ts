import type { DarkwebIndexContractDto, DarkwebIndexNetwork, DarkwebIndexRecord, DarkwebIndexSearchDto } from "./darkwebIndexTypes.ts";
import { rowsFromRuntime } from "./darkwebIndexFixtures.ts";
import { buyerRow, noLeak } from "./darkwebIndexHelpers.ts";

export function searchDarkwebIndex(input: { records?: readonly DarkwebIndexRecord[]; sources?: any[]; captures?: any[]; actorProfiles?: any[]; q?: string; query?: string; network?: DarkwebIndexNetwork | string; category?: string; legalTriage?: string; reviewState?: string; limit?: number; cursor?: string }): DarkwebIndexSearchDto {
  const rows = input.records ? [...input.records] : rowsFromRuntime(input);
  const query = (input.q ?? input.query ?? "").trim().toLowerCase();
  const offset = Math.max(0, Number(input.cursor ?? 0) || 0);
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const filtered = rows.filter((row) =>
    (!query || JSON.stringify(buyerRow(row)).toLowerCase().includes(query)) &&
    (!input.network || row.network === input.network) &&
    (!input.category || row.category === input.category) &&
    (!input.legalTriage || row.legalTriage === input.legalTriage) &&
    (!input.reviewState || row.reviewState === input.reviewState)
  );
  const page = filtered.slice(offset, offset + limit).map(buyerRow);
  const canonicalIdentity = resolveCanonicalActor(query, input.actorProfiles ?? [], filtered.length);
  return {
    generatedAt: new Date().toISOString(),
    query,
    filters: { network: input.network, category: input.category, legalTriage: input.legalTriage, reviewState: input.reviewState },
    count: filtered.length,
    rows: page,
    canonicalIdentity,
    nextCursor: offset + page.length < filtered.length ? String(offset + page.length) : undefined,
    noLeakSerialization: noLeak()
  };
}

function resolveCanonicalActor(query: string, profiles: any[], restrictedRecordCount: number): DarkwebIndexSearchDto["canonicalIdentity"] {
  if (!query) return undefined;
  const normalizedQuery = normalizeIdentity(query);
  const matches = profiles.filter((profile) => [profile.canonicalName, ...(profile.aliases ?? [])].some((name) => normalizeIdentity(name) === normalizedQuery));
  const canonicalNames = uniqueByNormalized(matches.map((profile) => profile.canonicalName));
  if (canonicalNames.length !== 1) return undefined;
  const canonicalName = canonicalNames[0];
  return {
    type: "actor",
    canonicalName,
    aliases: uniqueByNormalized(matches.flatMap((profile) => [profile.canonicalName, ...(profile.aliases ?? [])])),
    canonicalPath: `/ti/${encodeURIComponent(canonicalName)}`,
    restrictedEvidenceState: restrictedRecordCount ? "available" : "no_approved_restricted_evidence",
    restrictedRecordCount,
  };
}

function uniqueByNormalized(values: unknown[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const text = String(value ?? "").trim();
    const normalized = normalizeIdentity(text);
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [text];
  });
}

function normalizeIdentity(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function darkwebIndexContract(): DarkwebIndexContractDto {
  return {
    routes: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"],
    searchableFields: ["title", "safeSummary", "actorHints", "victimHints", "datasetHints", "sectorHints", "countryHints"],
    safety: { metadataOnly: true, isolatedCollectorOnly: true, noPayloadFollowing: true, noCredentialDownloads: true, noPrivateAccess: true, noCaptchaSolving: true, noThreatActorInteraction: true, noRawUnsafeUrlPublicOutput: true },
    sourceIngest: { sourceTypes: ["directory", "seed_list", "analyst_import", "public_report", "safe_search_result", "internal_discovery"], approvalStates: ["approved_metadata_only", "pending_legal_review", "disabled_kill_switch", "blocked_unsafe"], dedupeKeys: ["rawUrlHash", "sourceHash", "safeLocatorHash"], runtimeMode: "metadata_only" }
  };
}
