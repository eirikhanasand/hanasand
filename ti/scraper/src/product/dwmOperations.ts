import { classifySourceFamily, normalizeWatchlist } from "./dwmProduct.ts";
import { nowIso } from "../utils.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

export interface DwmOperationsSnapshot {
  schemaVersion: "dwm.operations.v1";
  generatedAt: string;
  tenantId: string;
  watchlistTerms: string[];
  counts: {
    sourceCount: number;
    activeSourceCount: number;
    telegramSourceCount: number;
    darkwebMetadataSourceCount: number;
    captureCount: number;
    latestCaptureCount: number;
    watchlistMatchCount: number;
    latestRunStatus?: string;
    latestRunCaptureCount?: number;
  };
  latestRun?: {
    id: string;
    status: string;
    updatedAt: string;
    taskCount: number;
    captureCount: number;
    error?: string;
  };
  latestCaptures: Array<{
    id: string;
    sourceId: string;
    sourceName: string;
    family: string;
    collectedAt: string;
    storageKind: string;
    redactionState: "metadata_only" | "redacted" | "public_safe";
    contentHash: string;
    safeExcerpt: string;
    matchedWatchTerms: string[];
  }>;
  sourceHealth: Array<{
    sourceId: string;
    sourceName: string;
    family: string;
    status: string;
    trustScore?: number;
    lastCollectedAt?: string;
    approvedMetadataOnly: boolean;
  }>;
  zeroAlertExplanation: {
    state: "matches_found" | "monitoring_no_matches" | "missing_watchlist" | "missing_sources";
    message: string;
  };
}

export function buildDwmOperationsSnapshot(input: {
  tenantId?: string;
  watchlist?: Array<string | { value?: string }>;
  sources: SourceRecord[];
  captures: RawCapture[];
  runs?: any[];
  generatedAt?: string;
}): DwmOperationsSnapshot {
  const generatedAt = input.generatedAt ?? nowIso();
  const tenantId = input.tenantId ?? "default";
  const scope = input.tenantId;
  const watchlist = normalizeWatchlist(input.watchlist ?? []);
  const terms = watchlist.map((term) => term.value);
  const sources = (input.sources ?? []).filter((source) => inTenant(source, scope));
  const sourceIds = new Set(sources.map((source) => source.id));
  const captures = (input.captures ?? []).filter((capture) => inTenant(capture, scope) && sourceIds.has(capture.sourceId));
  const sourceById = new Map(sources.map((source: any) => [String(source.id), source]));
  const latestRun = (input.runs ?? [])
    .filter((run: any) => inTenant(run, scope))
    .filter((run: any) => run.requestId === "req_public_canary" || run.id)
    .sort((a: any, b: any) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))[0];
  const latestCaptures = captures
    .slice()
    .sort((a: any, b: any) => String(b.collectedAt ?? "").localeCompare(String(a.collectedAt ?? "")))
    .slice(0, 20)
    .map((capture: any) => captureDto(capture, sourceById.get(String(capture.sourceId)), terms));
  const watchlistMatchCount = latestCaptures.reduce((sum, capture) => sum + (capture.matchedWatchTerms.length ? 1 : 0), 0);
  const activeSourceCount = sources.filter((source: any) => ["active", "canary", "approved"].includes(String(source.status ?? "").toLowerCase())).length;

  return {
    schemaVersion: "dwm.operations.v1",
    generatedAt,
    tenantId,
    watchlistTerms: terms,
    counts: {
      sourceCount: sources.length,
      activeSourceCount,
      telegramSourceCount: sources.filter((source) => classifySourceFamily(source) === "telegram_public").length,
      darkwebMetadataSourceCount: sources.filter((source) => classifySourceFamily(source) === "darkweb_metadata").length,
      captureCount: captures.length,
      latestCaptureCount: latestCaptures.length,
      watchlistMatchCount,
      latestRunStatus: latestRun?.status,
      latestRunCaptureCount: latestRun?.captureCount
    },
    latestRun: latestRun ? {
      id: String(latestRun.id),
      status: String(latestRun.status ?? "unknown"),
      updatedAt: String(latestRun.updatedAt ?? generatedAt),
      taskCount: Number(latestRun.taskCount ?? 0),
      captureCount: Number(latestRun.captureCount ?? 0),
      error: latestRun.error ? String(latestRun.error) : undefined
    } : undefined,
    latestCaptures,
    sourceHealth: sources
      .slice()
      .sort((a: any, b: any) => sourceSortScore(b) - sourceSortScore(a))
      .slice(0, 24)
      .map((source: any) => ({
        sourceId: String(source.id),
        sourceName: String(source.name ?? source.id),
        family: classifySourceFamily(source),
        status: String(source.status ?? "unknown"),
        trustScore: typeof source.trustScore === "number" ? source.trustScore : undefined,
        lastCollectedAt: source.crawlState?.lastCollectedAt,
        approvedMetadataOnly: Boolean(source.governance?.metadataOnly || source.metadata?.metadataOnlyApproved)
      })),
    zeroAlertExplanation: explainZeroAlerts({ terms, activeSourceCount, watchlistMatchCount })
  };
}

function inTenant(record: { tenantId?: string }, tenantId?: string): boolean {
  return (record.tenantId || undefined) === tenantId;
}

function captureDto(capture: any, source: any, terms: string[]): DwmOperationsSnapshot["latestCaptures"][number] {
  const text = captureText(capture);
  const matchedWatchTerms = terms.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
  const family = classifySourceFamily(source, capture);
  return {
    id: String(capture.id),
    sourceId: String(capture.sourceId ?? source?.id ?? "unknown"),
    sourceName: String(source?.name ?? capture.sourceId ?? "Unknown source"),
    family,
    collectedAt: String(capture.collectedAt ?? ""),
    storageKind: String(capture.storageKind ?? "unknown"),
    redactionState: capture.storageKind === "metadata_only" || family === "darkweb_metadata" ? "metadata_only" : capture.sensitive ? "redacted" : "public_safe",
    contentHash: String(capture.contentHash ?? ""),
    safeExcerpt: safeExcerpt(text),
    matchedWatchTerms
  };
}

function captureText(capture: any): string {
  const leakSite = capture.metadata?.leakSite ? JSON.stringify(capture.metadata.leakSite) : "";
  return [capture.title, capture.body, capture.rawText, capture.metadata?.safeExcerpt, capture.metadata?.description, leakSite, capture.url].filter(Boolean).join(" ");
}

function safeExcerpt(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b\d{8,}\b/g, "[number]")
    .replace(/https?:\/\/\S+\.onion\S*/gi, "[restricted-url]")
    .slice(0, 220) || "Metadata captured; no safe text excerpt available.";
}

function sourceSortScore(source: any): number {
  const status = ["active", "canary", "approved"].includes(String(source.status ?? "").toLowerCase()) ? 10 : 0;
  const darkweb = classifySourceFamily(source) === "darkweb_metadata" ? 2 : 0;
  return status + darkweb + Number(source.trustScore ?? 0);
}

function explainZeroAlerts(input: { terms: string[]; activeSourceCount: number; watchlistMatchCount: number }): DwmOperationsSnapshot["zeroAlertExplanation"] {
  if (!input.terms.length) return { state: "missing_watchlist", message: "No watchlist terms are saved yet." };
  if (!input.activeSourceCount) return { state: "missing_sources", message: "No active sources are available for matching." };
  if (input.watchlistMatchCount > 0) return { state: "matches_found", message: "Recent captures include watchlist matches." };
  return { state: "monitoring_no_matches", message: "Sources are collecting, but recent captures do not mention the saved watchlist terms." };
}
