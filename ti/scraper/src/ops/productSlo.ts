import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CollectionRun, IncidentCandidate, RawCapture, SourceRecord } from "../types.ts";
import type { FrontierGroupSummary } from "../frontier/frontier.ts";
import { nowIso, stableId } from "../utils.ts";

export type LiveProductProofMode = "fixture" | "local" | "inspur" | "public_live";
export type LiveProductSloState = "pass" | "warn" | "alert" | "unavailable";

export interface BuildLiveProductSloDashboardInput {
  generatedAt?: string;
  proofMode?: LiveProductProofMode;
  runs: CollectionRun[];
  sources: SourceRecord[];
  captures: RawCapture[];
  incidents: IncidentCandidate[];
  frontier: FrontierGroupSummary;
  resource?: { memoryTargetMb: number; memoryCeilingMb: number };
  snapshotStoragePath?: string;
}

export interface LiveProductOperationalMetrics {
  sources: { total: number; active: number };
  captures: {
    total: number;
    public: number;
    sensitive: number;
    collectedLast24Hours: number;
    latestCollectedAt: string | null;
    latestCaptureAgeSeconds: number | null;
    missingCollectedAt: number;
    futureCollectedAt: number;
  };
  incidents: { total: number };
  runs: { queued: number; running: number; completed: number; failed: number; cancelled: number; other: number };
  queue: { queued: number; leased: number };
}

export interface LiveProductSloObjective {
  id: "active_sources" | "collection_freshness" | "capture_timestamp_quality";
  state: LiveProductSloState;
  value: number | null;
  target: number;
  unit: "count" | "seconds";
}

export interface LiveProductDailySnapshot {
  snapshotId: string;
  snapshotDate: string;
  generatedAt: string;
  appendOnly: true;
  proofMode: LiveProductProofMode;
  storagePath?: string;
  state: LiveProductSloState;
  metrics: LiveProductOperationalMetrics;
  slos: LiveProductSloObjective[];
}

export interface LiveProductSloDashboard {
  schemaVersion: "ti.product_operational_slo.v1";
  generatedAt: string;
  proofMode: LiveProductProofMode;
  dashboard: {
    state: LiveProductSloState;
    activeSources: number;
    totalCaptures: number;
    capturesLast24Hours: number;
    latestCollectedAt: string | null;
    queueDepth: number;
  };
  metrics: LiveProductOperationalMetrics;
  slos: LiveProductSloObjective[];
  measurementBoundary: {
    source: "persisted_store_and_runtime_config";
    excludes: ["accuracy", "customer_value", "revenue", "profitability"];
  };
  resourceGuardrails: {
    source: "runtime_config" | "unavailable";
    scraperTargetRamMb: number | null;
    scraperNormalCeilingMb: number | null;
  };
  dailySnapshot: LiveProductDailySnapshot;
}

const FRESHNESS_TARGET_SECONDS = 24 * 60 * 60;

export function buildLiveProductSloDashboard(input: BuildLiveProductSloDashboardInput): LiveProductSloDashboard {
  const generatedAt = input.generatedAt ?? nowIso();
  const generatedAtMs = validTime(generatedAt) ?? Date.now();
  const captureTimes = input.captures.map((capture) => validTime(capture.collectedAt));
  const validCaptureTimes = captureTimes.filter((value): value is number => value !== null);
  const latestCaptureMs = validCaptureTimes.length > 0 ? Math.max(...validCaptureTimes) : null;
  const latestCaptureAgeSeconds = latestCaptureMs === null ? null : Math.max(0, Math.floor((generatedAtMs - latestCaptureMs) / 1000));
  const runStatuses = countRunStatuses(input.runs);
  const activeSources = input.sources.filter((source) => source.status === "active").length;
  const futureCollectedAt = validCaptureTimes.filter((value) => value > generatedAtMs).length;
  const metrics: LiveProductOperationalMetrics = {
    sources: { total: input.sources.length, active: activeSources },
    captures: {
      total: input.captures.length,
      public: input.captures.filter((capture) => !capture.sensitive).length,
      sensitive: input.captures.filter((capture) => capture.sensitive === true).length,
      collectedLast24Hours: validCaptureTimes.filter((value) => value <= generatedAtMs && generatedAtMs - value <= FRESHNESS_TARGET_SECONDS * 1000).length,
      latestCollectedAt: latestCaptureMs === null ? null : new Date(latestCaptureMs).toISOString(),
      latestCaptureAgeSeconds,
      missingCollectedAt: captureTimes.filter((value) => value === null).length,
      futureCollectedAt
    },
    incidents: { total: input.incidents.length },
    runs: runStatuses,
    queue: {
      queued: finiteNumber(input.frontier?.queued),
      leased: finiteNumber(input.frontier?.leased)
    }
  };
  const slos: LiveProductSloObjective[] = [
    { id: "active_sources", state: activeSources > 0 ? "pass" : "alert", value: activeSources, target: 1, unit: "count" },
    {
      id: "collection_freshness",
      state: latestCaptureAgeSeconds === null ? "unavailable" : latestCaptureAgeSeconds <= FRESHNESS_TARGET_SECONDS ? "pass" : "alert",
      value: latestCaptureAgeSeconds,
      target: FRESHNESS_TARGET_SECONDS,
      unit: "seconds"
    },
    {
      id: "capture_timestamp_quality",
      state: metrics.captures.missingCollectedAt + futureCollectedAt === 0 ? "pass" : "warn",
      value: metrics.captures.missingCollectedAt + futureCollectedAt,
      target: 0,
      unit: "count"
    }
  ];
  const state = overallState(slos, input.sources.length, input.captures.length);
  const proofMode = input.proofMode ?? "local";
  const dailySnapshot: LiveProductDailySnapshot = {
    snapshotId: stableId("product-slo", generatedAt),
    snapshotDate: generatedAt.slice(0, 10),
    generatedAt,
    appendOnly: true,
    proofMode,
    storagePath: input.snapshotStoragePath,
    state,
    metrics,
    slos
  };

  return {
    schemaVersion: "ti.product_operational_slo.v1",
    generatedAt,
    proofMode,
    dashboard: {
      state,
      activeSources,
      totalCaptures: input.captures.length,
      capturesLast24Hours: metrics.captures.collectedLast24Hours,
      latestCollectedAt: metrics.captures.latestCollectedAt,
      queueDepth: metrics.queue.queued + metrics.queue.leased
    },
    metrics,
    slos,
    measurementBoundary: {
      source: "persisted_store_and_runtime_config",
      excludes: ["accuracy", "customer_value", "revenue", "profitability"]
    },
    resourceGuardrails: {
      source: input.resource ? "runtime_config" : "unavailable",
      scraperTargetRamMb: input.resource?.memoryTargetMb ?? null,
      scraperNormalCeilingMb: input.resource?.memoryCeilingMb ?? null
    },
    dailySnapshot
  };
}

export async function appendLiveProductDailySnapshot(path: string, snapshot: LiveProductDailySnapshot): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify({ ...snapshot, appendOnly: true })}\n`, "utf8");
}

export async function readLiveProductDailySnapshots(path: string): Promise<LiveProductDailySnapshot[]> {
  try {
    const text = await readFile(path, "utf8");
    return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function countRunStatuses(runs: CollectionRun[]): LiveProductOperationalMetrics["runs"] {
  const counts = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0, other: 0 };
  for (const run of runs) {
    const status = String(run.status ?? "other");
    if (status in counts && status !== "other") counts[status as keyof Omit<typeof counts, "other">] += 1;
    else counts.other += 1;
  }
  return counts;
}

function overallState(slos: LiveProductSloObjective[], sourceCount: number, captureCount: number): LiveProductSloState {
  if (sourceCount === 0 && captureCount === 0) return "unavailable";
  if (slos.some((slo) => slo.state === "alert")) return "alert";
  if (slos.some((slo) => slo.state === "warn" || slo.state === "unavailable")) return "warn";
  return "pass";
}

function validTime(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
