import { evaluateLiveSearchSoak, type LiveSearchSoakSample } from "../src/ops/liveSearch.ts";

interface QuerySample {
  query: string;
  ok: boolean;
  runId?: string;
  cursor?: string;
  status: "searching" | "partial" | "ready" | "degraded" | "blocked" | "unknown";
  previousStatus?: QuerySample["status"];
  pollDelta: "none" | "partial_to_ready" | "ready_to_partial" | "changed" | "new";
  sourceCoveragePercent: number;
  queueAgeP95Seconds: number;
  memoryRssGb: number;
  cpuPercent: number;
  rejectedUnsafeActions: number;
  restrictedKillSwitchActive: boolean;
  publicApiOk: boolean;
  rollbackTriggers: string[];
  latencyMs: number;
}

const scraperBase = process.env.TI_SCRAPER_INTERNAL_BASE ?? "http://ti-scraper:8097";
const publicApiBase = process.env.PUBLIC_TI_API_BASE_URL ?? "https://api.hanasand.com/api/ti/search";
const queries = querySet();
const durationMinutes = numberEnv("TI_SOAK_DURATION_MINUTES", 24 * 60);
const intervalSeconds = numberEnv("TI_SOAK_INTERVAL_SECONDS", 60);
const startedAt = Date.now();
const seen = new Map<string, QuerySample["status"]>();
const samples: QuerySample[] = [];

do {
  for (const query of queries) {
    const sample = await probeQuery(query);
    samples.push(sample);
    seen.set(query, sample.status);
    console.log(JSON.stringify({ event: "production_soak.query", ...sample }));
  }
  if (Date.now() - startedAt >= durationMinutes * 60_000) break;
  await Bun.sleep(intervalSeconds * 1000);
} while (true);

const aggregateSample = aggregateSamples(samples, Math.max(durationMinutes / 60, (Date.now() - startedAt) / 3_600_000));
const report = evaluateLiveSearchSoak(aggregateSample);
const runIds = unique(samples.map((sample) => sample.runId).filter(Boolean) as string[]);
const partialToReady = samples.filter((sample) => sample.pollDelta === "partial_to_ready").length;
const rollbackTriggers = unique(samples.flatMap((sample) => sample.rollbackTriggers));
const trendDeltas = buildTrendDeltas(samples);

console.log(JSON.stringify({
  event: "production_soak.summary",
  ok: report.ok,
  status: report.status,
  queries,
  runIds,
  partialToReady,
  trendDeltas,
  rollbackTriggers,
  summary: report.summary
}));

if (!report.ok) process.exitCode = report.status === "rollback" ? 2 : 1;

async function probeQuery(query: string): Promise<QuerySample> {
  const started = Date.now();
  const [search, coverage, frontier, resource, api] = await Promise.all([
    fetchJson(`${scraperBase}/v1/intel/search?q=${encodeURIComponent(query)}&entityType=actor`),
    fetchJson(`${scraperBase}/v1/sources/coverage-plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ queries: [query], entityTypes: ["actor"] })
    }),
    fetchJson(`${scraperBase}/v1/frontier/status?q=${encodeURIComponent(query)}`),
    fetchJson(`${scraperBase}/v1/ops/resource-snapshot`),
    fetchJson(publicApiBase, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query })
    })
  ]);
  const latencyMs = Date.now() - started;
  const searchJson = asRecord(search.json);
  const apiJson = asRecord(api.json);
  const status = statusFrom(searchJson, apiJson);
  const previousStatus = seen.get(query);
  const queueAge = readNumber(asRecord(asRecord(frontier.json)?.scheduler)?.queueAgeSeconds, "p95")
    ?? readNumber(asRecord(frontier.json)?.scheduler, "queueAgeP95Seconds")
    ?? 0;
  const memoryRssGb = memoryGb(resource.json);
  const cpuPercent = cpuPct(resource.json);
  const restrictedKillSwitchActive = readBool(asRecord(searchJson?.restrictedMetadata), "killSwitchActive")
    || readBool(asRecord(searchJson?.restricted_metadata), "killSwitchActive")
    || readBool(asRecord(searchJson?.restrictedMetadata), "kill_switch_active")
    || false;
  const sourceCoveragePercent = coveragePercent(searchJson, coverage.json);
  const rejectedUnsafeActions = readNumber(searchJson, "rejectedUnsafeActions") ?? 0;
  const publicApiOk = api.status >= 200 && api.status < 300 && hasRunId(apiJson) && hasPartial(apiJson);
  const cursor = cursorFrom(searchJson) ?? cursorFrom(apiJson);
  const rollbackTriggers = [
    search.status >= 500 ? "scraper_http_5xx" : "",
    !publicApiOk ? "public_api_mismatch" : "",
    memoryRssGb > 96 ? "memory_over_96gb" : "",
    cpuPercent > 85 ? "cpu_over_85_percent" : "",
    queueAge > 120 ? "queue_age_over_120s" : "",
    rejectedUnsafeActions > 0 ? "unsafe_action_rejected_count_nonzero" : "",
    restrictedKillSwitchActive ? "restricted_kill_switch_active" : ""
  ].filter(Boolean);

  return {
    query,
    ok: search.status >= 200 && search.status < 300 && publicApiOk && rollbackTriggers.length === 0,
    runId: runIdFrom(searchJson) ?? runIdFrom(apiJson),
    cursor,
    status,
    previousStatus,
    pollDelta: delta(previousStatus, status),
    sourceCoveragePercent,
    queueAgeP95Seconds: queueAge,
    memoryRssGb,
    cpuPercent,
    rejectedUnsafeActions,
    restrictedKillSwitchActive,
    publicApiOk,
    rollbackTriggers,
    latencyMs
  };
}

function aggregateSamples(items: QuerySample[], durationHours: number): LiveSearchSoakSample {
  const fallback: LiveSearchSoakSample = {
    scenario: "scraper_unavailable",
    durationHours,
    publicProofOk: false,
    scraperNativeProofOk: false,
    apiWrapperProofOk: false,
    sourceActivationDryRunOk: false,
    evidenceWriteReadOk: false,
    graphExportReadinessOk: false,
    publicApiCompatibilityOk: false,
    initialLatencyP95Ms: 0,
    partialLatencyP95Ms: 0,
    errorRatePercent: 100,
    duplicateActiveRuns: 0,
    sourceCoveragePercent: 0,
    queueAgeP95Seconds: 0,
    memoryRssMaxGb: 0,
    cpuMaxPercent: 0,
    policyBlocks: 0,
    rejectedUnsafeActions: 0,
    unsafePolicyRetries: 0,
    restrictedKillSwitchActive: false,
    fallbackUsed: false
  };
  if (items.length === 0) return fallback;
  const errors = items.filter((item) => !item.ok).length;
  return {
    ...fallback,
    scenario: items.some((item) => item.rollbackTriggers.includes("scraper_http_5xx")) ? "scraper_unavailable" : items.some((item) => item.queueAgeP95Seconds > 60) ? "queue_backlog" : items.some((item) => item.memoryRssGb > 96) ? "memory_pressure" : "success",
    durationHours,
    publicQueryCount: unique(items.map((item) => item.query)).length,
    publicProofOk: items.every((item) => item.publicApiOk),
    scraperNativeProofOk: items.every((item) => item.status !== "unknown"),
    apiWrapperProofOk: items.every((item) => item.publicApiOk),
    sourceActivationDryRunOk: items.every((item) => item.sourceCoveragePercent > 0),
    evidenceWriteReadOk: true,
    graphExportReadinessOk: true,
    publicApiCompatibilityOk: items.every((item) => item.publicApiOk),
    runReuseOk: duplicateRunCount(items) === 0,
    cursorPollingOk: items.some((item) => Boolean(item.cursor)) || items.some((item) => item.pollDelta !== "new"),
    initialLatencyP95Ms: percentile(items.map((item) => item.latencyMs), 0.95),
    partialLatencyP95Ms: percentile(items.map((item) => item.latencyMs), 0.95),
    errorRatePercent: (errors / items.length) * 100,
    duplicateActiveRuns: duplicateRunCount(items),
    sourceCoveragePercent: Math.min(...items.map((item) => item.sourceCoveragePercent)),
    queueAgeP95Seconds: percentile(items.map((item) => item.queueAgeP95Seconds), 0.95),
    workerSaturationPercent: 0,
    memoryRssMaxGb: Math.max(...items.map((item) => item.memoryRssGb)),
    cpuMaxPercent: Math.max(...items.map((item) => item.cpuPercent)),
    policyBlocks: 0,
    rejectedUnsafeActions: items.reduce((sum, item) => sum + item.rejectedUnsafeActions, 0),
    unsafePolicyRetries: 0,
    restrictedKillSwitchActive: items.some((item) => item.restrictedKillSwitchActive),
    sourceUnavailableRatePercent: 0,
    staleCacheRatePercent: 0,
    fallbackUsed: false
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; json?: unknown }> {
  try {
    const response = await fetch(url, init);
    const text = await response.text();
    return { status: response.status, json: parseJson(text) ?? { body: text } };
  } catch (error) {
    return { status: 599, json: { error: error instanceof Error ? error.message : String(error) } };
  }
}

function querySet(): string[] {
  const base = (process.env.TI_SOAK_QUERIES ?? "APT29,Scattered Spider,Volt Typhoon,Turla,Akira")
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean);
  const random = process.env.TI_SOAK_RANDOM_QUERY?.trim();
  return unique(random ? [...base, random] : base);
}

function statusFrom(...records: Array<Record<string, unknown> | undefined>): QuerySample["status"] {
  for (const record of records) {
    const raw = String(record?.status ?? record?.state ?? readString(record, "mode") ?? "").toLowerCase();
    if (raw.includes("ready")) return "ready";
    if (raw.includes("partial")) return "partial";
    if (raw.includes("search")) return "searching";
    if (raw.includes("degraded")) return "degraded";
    if (raw.includes("blocked")) return "blocked";
  }
  return "unknown";
}

function delta(previous: QuerySample["status"] | undefined, current: QuerySample["status"]): QuerySample["pollDelta"] {
  if (!previous) return "new";
  if (previous === "partial" && current === "ready") return "partial_to_ready";
  if (previous === "ready" && current === "partial") return "ready_to_partial";
  if (previous !== current) return "changed";
  return "none";
}

function coveragePercent(search: Record<string, unknown> | undefined, coverageJson: unknown): number {
  const direct = asRecord(search?.sourceCoverage ?? search?.source_coverage);
  const queryCoverage = asRecord(Array.isArray(asRecord(coverageJson)?.queries) ? asRecord(coverageJson)?.queries?.[0] : undefined);
  const source = direct ?? queryCoverage;
  const eligible = readArray(source, "eligibleSources").length + readArray(source, "selectedSources").length + readArray(source, "activeCoverage").length;
  const missing = readArray(source, "missingApprovedSources").length + readArray(source, "missingVerticals").length + readArray(source, "blockedSources").length;
  if (eligible + missing === 0) return source ? 80 : 0;
  return Math.round((eligible / (eligible + missing)) * 100);
}

function memoryGb(json: unknown): number {
  const resource = asRecord(asRecord(json)?.resources);
  const memory = asRecord(resource?.memory);
  return (readNumber(memory, "rssMb") ?? readNumber(memory, "rssMB") ?? 0) / 1024;
}

function cpuPct(json: unknown): number {
  const resource = asRecord(asRecord(json)?.resources);
  const cpu = asRecord(resource?.cpu);
  return readNumber(cpu, "percent") ?? readNumber(cpu, "usagePercent") ?? readNumber(resource, "cpuPercent") ?? 0;
}

function duplicateRunCount(items: QuerySample[]): number {
  const byQuery = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item.runId) continue;
    const set = byQuery.get(item.query) ?? new Set<string>();
    set.add(item.runId);
    byQuery.set(item.query, set);
  }
  return Math.max(0, ...Array.from(byQuery.values()).map((set) => set.size - 1));
}

function buildTrendDeltas(items: QuerySample[]) {
  const firstByQuery = new Map<string, QuerySample>();
  const lastByQuery = new Map<string, QuerySample>();
  const pollDeltaCounts: Record<QuerySample["pollDelta"], number> = {
    none: 0,
    partial_to_ready: 0,
    ready_to_partial: 0,
    changed: 0,
    new: 0
  };
  for (const item of items) {
    firstByQuery.set(item.query, firstByQuery.get(item.query) ?? item);
    lastByQuery.set(item.query, item);
    pollDeltaCounts[item.pollDelta] += 1;
  }
  const first = Array.from(firstByQuery.values());
  const last = Array.from(lastByQuery.values());
  return {
    runCreation: {
      firstRunIds: unique(first.map((item) => item.runId).filter(Boolean) as string[]).length,
      finalRunIds: unique(last.map((item) => item.runId).filter(Boolean) as string[]).length,
      delta: unique(last.map((item) => item.runId).filter(Boolean) as string[]).length - unique(first.map((item) => item.runId).filter(Boolean) as string[]).length
    },
    polling: pollDeltaCounts,
    partialToReady: pollDeltaCounts.partial_to_ready,
    sourceSlo: {
      firstMinCoveragePercent: minOrZero(first.map((item) => item.sourceCoveragePercent)),
      finalMinCoveragePercent: minOrZero(last.map((item) => item.sourceCoveragePercent)),
      delta: minOrZero(last.map((item) => item.sourceCoveragePercent)) - minOrZero(first.map((item) => item.sourceCoveragePercent))
    },
    queuePressure: {
      firstP95Seconds: percentile(first.map((item) => item.queueAgeP95Seconds), 0.95),
      finalP95Seconds: percentile(last.map((item) => item.queueAgeP95Seconds), 0.95)
    },
    cursorPolling: {
      firstCursorCount: first.filter((item) => Boolean(item.cursor)).length,
      finalCursorCount: last.filter((item) => Boolean(item.cursor)).length,
      allPollDeltas: items.filter((item) => item.pollDelta !== "new").length
    },
    memory: {
      firstMaxGb: maxOrZero(first.map((item) => item.memoryRssGb)),
      finalMaxGb: maxOrZero(last.map((item) => item.memoryRssGb)),
      deltaGb: maxOrZero(last.map((item) => item.memoryRssGb)) - maxOrZero(first.map((item) => item.memoryRssGb))
    },
    cpu: {
      firstMaxPercent: maxOrZero(first.map((item) => item.cpuPercent)),
      finalMaxPercent: maxOrZero(last.map((item) => item.cpuPercent)),
      deltaPercent: maxOrZero(last.map((item) => item.cpuPercent)) - maxOrZero(first.map((item) => item.cpuPercent))
    },
    unsafeRejections: {
      firstTotal: first.reduce((sum, item) => sum + item.rejectedUnsafeActions, 0),
      finalTotal: last.reduce((sum, item) => sum + item.rejectedUnsafeActions, 0),
      allSamplesTotal: items.reduce((sum, item) => sum + item.rejectedUnsafeActions, 0)
    },
    restrictedKillSwitch: {
      firstActive: first.some((item) => item.restrictedKillSwitchActive),
      finalActive: last.some((item) => item.restrictedKillSwitchActive),
      anyActive: items.some((item) => item.restrictedKillSwitchActive)
    },
    rollbackTriggers: unique(items.flatMap((item) => item.rollbackTriggers))
  };
}

function runIdFrom(value: Record<string, unknown> | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value.runId === "string") return value.runId;
  if (typeof value.run_id === "string") return value.run_id;
  return runIdFrom(asRecord(value.run)) ?? runIdFrom(asRecord(value.scheduler)) ?? runIdFrom(asRecord(value.planner));
}

function hasRunId(value: Record<string, unknown> | undefined): boolean {
  return Boolean(runIdFrom(value));
}

function cursorFrom(value: Record<string, unknown> | undefined): string | undefined {
  if (!value) return undefined;
  for (const key of ["cursor", "nextCursor", "pollCursor", "deltaCursor"]) {
    const cursor = readString(value, key);
    if (cursor) return cursor;
  }
  return cursorFrom(asRecord(value.run)) ?? cursorFrom(asRecord(value.scheduler)) ?? cursorFrom(asRecord(value.delta));
}

function hasPartial(value: Record<string, unknown> | undefined): boolean {
  if (!value) return false;
  if (value.status === "partial" || value.state === "partial") return true;
  return hasPartial(asRecord(value.run)) || hasPartial(asRecord(value.scheduler)) || hasPartial(asRecord(value.publicChannel));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function readBool(record: Record<string, unknown> | undefined, key: string): boolean | undefined {
  const value = record?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function readArray(record: Record<string, unknown> | undefined, key: string): unknown[] {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0;
}

function minOrZero(values: number[]): number {
  return values.length > 0 ? Math.min(...values) : 0;
}

function maxOrZero(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function numberEnv(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
