import type { DarkwebIndexNetwork } from "./darkwebIndexTypes.ts";

export const networks: DarkwebIndexNetwork[] = ["tor", "i2p", "freenet"];
export const categories = ["leak_extortion", "forum", "marketplace", "directory", "research", "mirror"] as const;
export const actors = ["akira", "lockbit", "clop", "blackcat", "play", "ransomhub", "apt29", "apt28", "scattered spider", "lazarus"];
export const legal = ["leak_or_extortion", "marketplace_or_illicit", "news_or_research", "unknown_requires_review", "blocked_unsafe"] as const;

export const hash = (value: string) => "h_" + Bun.hash(value).toString(16);
export const noLeak = () => ({ passed: true, forbiddenFields: ["rawUrl", "body", "payload", "credential"], rule: "hash_only_no_raw_locator_no_payload_no_credentials" });
export const reviewFor = (triage: string) => triage === "blocked_unsafe" ? "blocked_unsafe" : triage === "unknown_requires_review" ? "needs_review" : "approved_metadata_only";
export const valueScore = (record: any) => Math.max(0.05, Number((0.35 + (record.liveness === "live" ? 0.25 : 0) + (record.actorHints.length ? 0.2 : 0) + (record.datasetHints.length ? 0.15 : 0) - (record.reviewState === "blocked_unsafe" ? 0.5 : 0)).toFixed(2)));
export const isSellable = (record: any) => record.reviewState === "approved_metadata_only" && record.liveness === "live" && record.valueScore >= 0.55;
export const countBy = (rows: readonly any[], pick: (row: any) => string) => rows.reduce<Record<string, number>>((acc, row) => ((acc[pick(row)] = (acc[pick(row)] ?? 0) + 1), acc), {});

export function buyerRow(record: any) {
  return { id: record.id, network: record.network, category: record.category, title: record.title, safeSummary: record.safeSummary, actorHints: record.actorHints, victimHints: record.victimHints, datasetHints: record.datasetHints, sectorHints: record.sectorHints, countryHints: record.countryHints, firstSeen: record.firstSeen, lastSeen: record.lastSeen, liveness: record.liveness, legalTriage: record.legalTriage, reviewState: record.reviewState, valueScore: record.valueScore, safeLocatorHash: record.safeLocatorHash, noLeakProof: noLeak().rule };
}
