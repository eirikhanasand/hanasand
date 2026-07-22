import type { DarkwebIndexBuyerRow, DarkwebIndexNetwork, DarkwebIndexNoLeakSerialization, DarkwebIndexRecord } from "./darkwebIndexTypes.ts";

export const networks: DarkwebIndexNetwork[] = ["tor", "i2p", "freenet"];

export const hash = (value: string) => "h_" + Bun.hash(value).toString(16);
export const noLeak = (): DarkwebIndexNoLeakSerialization => ({ passed: true, forbiddenFields: ["rawUrl", "body", "payload", "credential"], rule: "hash_only_no_raw_locator_no_payload_no_credentials" });
export const valueScore = (record: Pick<DarkwebIndexRecord, "liveness" | "actorHints" | "datasetHints" | "reviewState">) => Math.max(0.05, Number((0.35 + (record.liveness === "live" ? 0.25 : 0) + (record.actorHints.length ? 0.2 : 0) + (record.datasetHints.length ? 0.15 : 0) - (record.reviewState === "blocked_unsafe" ? 0.5 : 0)).toFixed(2)));
export const isSellable = (record: DarkwebIndexRecord) => record.reviewState === "approved_metadata_only" && record.liveness === "live" && record.actorHints.length > 0 && record.victimHints.length > 0 && record.valueScore >= 0.55;
export const countBy = (rows: readonly any[], pick: (row: any) => string) => rows.reduce<Record<string, number>>((acc, row) => ((acc[pick(row)] = (acc[pick(row)] ?? 0) + 1), acc), {});

export function buyerRow(record: DarkwebIndexRecord): DarkwebIndexBuyerRow {
  return { id: record.id, network: record.network, category: record.category, title: record.title, safeSummary: record.safeSummary, actorHints: record.actorHints, victimHints: record.victimHints, datasetHints: record.datasetHints, sectorHints: record.sectorHints, countryHints: record.countryHints, firstSeen: record.firstSeen, lastSeen: record.lastSeen, liveness: record.liveness, legalTriage: record.legalTriage, reviewState: record.reviewState, valueScore: record.valueScore, safeLocatorHash: record.safeLocatorHash, noLeakProof: noLeak().rule };
}
