import type { MarketplaceRow } from "./types.ts";
import { isStrictRecentPayworthySellableRow, strictSellableRowRejectionReasons } from "./liveDataMetrics.ts";
import { PRODUCTION_SELLABLE_ROW_FLOOR } from "./outputQuality/readiness.ts";

export const FIRST_SELLABLE_MILESTONE = 100_000;
export const FINAL_SELLABLE_MILESTONE = PRODUCTION_SELLABLE_ROW_FLOOR;

export type StrictSellableAudit = {
  schemaVersion: "ti.strict_sellable_audit.v1";
  generatedAt: string;
  rowCount: number;
  strictSellableRows: number;
  firstMilestoneRows: number;
  productionMilestoneRows: number;
  firstMilestoneReached: boolean;
  productionMilestoneReached: boolean;
  nextMilestoneRows: number | null;
  remainingToNextMilestone: number;
  duplicateStrictKeys: number;
  testRows: number;
  staleOrUnknownStrictCandidates: number;
  sourceBreakdown: Array<{ sourceName: string; rows: number }>;
  claimTypeBreakdown: Array<{ claimType: string; rows: number }>;
  rejectionBreakdown: Array<{ reason: string; rows: number }>;
};

export function strictSellableAuditForRows(rows: MarketplaceRow[], generatedAt = new Date().toISOString()): StrictSellableAudit {
  const strictRows = rows.filter(isStrictRecentPayworthySellableRow);
  const duplicateStrictKeys = duplicateCount(strictRows.map(strictDuplicateKey).filter((key): key is string => Boolean(key)));
  const nextMilestoneRows = strictRows.length >= FINAL_SELLABLE_MILESTONE
    ? null
    : strictRows.length >= FIRST_SELLABLE_MILESTONE
      ? FINAL_SELLABLE_MILESTONE
      : FIRST_SELLABLE_MILESTONE;
  return {
    schemaVersion: "ti.strict_sellable_audit.v1",
    generatedAt,
    rowCount: rows.length,
    strictSellableRows: strictRows.length,
    firstMilestoneRows: FIRST_SELLABLE_MILESTONE,
    productionMilestoneRows: FINAL_SELLABLE_MILESTONE,
    firstMilestoneReached: strictRows.length >= FIRST_SELLABLE_MILESTONE,
    productionMilestoneReached: strictRows.length >= FINAL_SELLABLE_MILESTONE,
    nextMilestoneRows,
    remainingToNextMilestone: nextMilestoneRows === null ? 0 : Math.max(0, nextMilestoneRows - strictRows.length),
    duplicateStrictKeys,
    testRows: rows.filter(hasTestMarker).length,
    staleOrUnknownStrictCandidates: rows.filter((row) => row.paidRowDecision === "sellable" && row.billingGuidance === "charge" && (row.freshnessStatus === "stale" || row.freshnessStatus === "unknown")).length,
    sourceBreakdown: countBy(strictRows, (row) => row.sourceName ?? row.sourceType ?? "unknown").slice(0, 20).map(([sourceName, rowCount]) => ({ sourceName, rows: rowCount })),
    claimTypeBreakdown: countBy(strictRows, (row) => row.claimType ?? "unknown").map(([claimType, rowCount]) => ({ claimType, rows: rowCount })),
    rejectionBreakdown: rejectionBreakdown(rows)
  };
}

function rejectionBreakdown(rows: MarketplaceRow[]): Array<{ reason: string; rows: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const reasons = strictSellableRowRejectionReasons(row);
    if (reasons.length === 0) continue;
    for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([reason, rowCount]) => ({ reason, rows: rowCount }));
}

function countBy<T>(items: T[], keyForItem: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyForItem(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function duplicateCount(keys: string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const key of keys) {
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

function strictDuplicateKey(row: MarketplaceRow): string | undefined {
  if (row.claimType === "victim_claim" && row.victimName) {
    return ["victim", normalizeKey(row.actor), normalizeKey(row.victimName), dayKey(row.claimedDate ?? row.lastSeen)].join("|");
  }
  if (row.claimType === "vulnerability_disclosure" && row.attackId) {
    return ["vulnerability", normalizeKey(row.attackId), dayKey(row.claimedDate ?? row.lastSeen)].join("|");
  }
  return undefined;
}

function normalizeKey(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
}

function dayKey(value: string | undefined): string {
  return Number.isFinite(Date.parse(value ?? "")) ? new Date(value ?? "").toISOString().slice(0, 10) : "";
}

function hasTestMarker(row: MarketplaceRow): boolean {
  return /\b(test|example|fixture|demo|sample)\b/i.test([row.title, row.summary, row.victimName, row.actor, row.query].join(" "));
}
