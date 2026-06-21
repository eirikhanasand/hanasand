import type { MarketplaceRow } from "./types.ts";
import { stableHash } from "./utils.ts";

export function withDataReality(row: MarketplaceRow): MarketplaceRow {
  const fixtureBacked = isFixtureBacked(row);
  const defaultWatchlistBacked = isDefaultWatchlist(row);
  const liveDataReal = !fixtureBacked && !defaultWatchlistBacked && hasLiveEvidence(row);
  return {
    ...row,
    fixtureBacked,
    defaultWatchlistBacked,
    liveDataReal,
    dataReality: liveDataReal ? "hosted_live_source" : fixtureBacked ? "fixture_backed" : defaultWatchlistBacked ? "default_watchlist" : "contract_only",
    distinctHostedSourceKey: liveDataReal ? stableHash(`${row.sourceType}:${row.sourceUrl ?? row.provenanceHash}:${row.sourceName ?? row.rowType}`).slice(0, 16) : undefined
  };
}

export function liveDataRealScore(row: MarketplaceRow): number {
  if (row.liveDataReal) return 0;
  if (row.dataReality === "contract_only") return 1;
  if (row.defaultWatchlistBacked) return 2;
  if (row.fixtureBacked) return 3;
  return 4;
}

function isFixtureBacked(row: MarketplaceRow): boolean {
  if (process.env.TI_ACTOR_FIXTURE_PATH) return true;
  const text = `${row.collectionMode} ${row.sourceUrl ?? ""} ${row.sourceName ?? ""} ${row.provenance ?? ""}`.toLowerCase();
  return /fixture|example\.test|localhost|127\.0\.0\.1|local_storage|smoke_fixture/.test(text);
}

function isDefaultWatchlist(row: MarketplaceRow): boolean {
  const text = `${row.collectionMode} ${row.schedulerBadges.join(" ")} ${row.warningCodes.join(" ")}`.toLowerCase();
  return text.includes("default-watchlist") || text.includes("default_watchlist");
}

function hasLiveEvidence(row: MarketplaceRow): boolean {
  if (row.sourceType !== "system" && Boolean(row.sourceUrl)) return true;
  return /live|fallback/.test(row.collectionMode) && row.sourceCount > 0 && row.sourceFamilies.length > 0;
}
