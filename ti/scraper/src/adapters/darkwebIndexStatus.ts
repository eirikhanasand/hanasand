import type { DarkwebIndexRecord, DarkwebIndexStatusDto } from "./darkwebIndexTypes.ts";
import { rowsFromRuntime } from "./darkwebIndexFixtures.ts";
import { buyerRow, countBy, isSellable, noLeak } from "./darkwebIndexHelpers.ts";

export function buildDarkwebIndexStatus(records: readonly DarkwebIndexRecord[] | { sources?: any[]; captures?: any[] } = []): DarkwebIndexStatusDto {
  const rows = Array.isArray(records) ? records : rowsFromRuntime(records as any);
  const sellable = rows.filter(isSellable);
  return {
    endpoint: "/v1/darkweb/status",
    generatedAt: new Date().toISOString(),
    metadataOnly: true,
    indexedRecordCount: rows.length,
    monitoredSourceCount: new Set(rows.map((row) => row.sourceHash)).size,
    sellableRowCount: sellable.length,
    liveRowCount: rows.filter((r) => r.liveness === "live").length,
    blockedRowCount: rows.filter((r) => r.reviewState === "blocked_unsafe").length,
    latestRecordAt: latestRecordAt(rows),
    counts: {
      byNetwork: countBy(rows, (r) => r.network),
      byLegalTriage: countBy(rows, (r) => r.legalTriage),
      byLiveness: countBy(rows, (r) => r.liveness),
      byReviewState: countBy(rows, (r) => r.reviewState),
    },
    noLeakSerialization: noLeak(),
    productHandoff: { buyerSearchRows: sellable.slice(0, 100).map(buyerRow), noLeakSerialization: noLeak() },
  };
}

function latestRecordAt(rows: readonly DarkwebIndexRecord[]) {
  const timestamps = rows.map((row) => Date.parse(row.lastSeen)).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : undefined;
}
