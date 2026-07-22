import type { QuerySample } from "./productionSoakTypes.ts";
import { asRecord, readArray, readNumber, readString } from "./productionSoakUtils.ts";

export function statusFrom(...records: Array<Record<string, unknown> | undefined>): QuerySample["status"] {
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

export function coveragePercent(search: Record<string, unknown> | undefined): number {
  const direct = asRecord(search?.sourceCoverage ?? search?.source_coverage);
  const eligible = readArray(direct, "eligibleSources").length + readArray(direct, "selectedSources").length + readArray(direct, "activeCoverage").length;
  const missing = readArray(direct, "missingApprovedSources").length + readArray(direct, "missingVerticals").length + readArray(direct, "blockedSources").length;
  if (eligible + missing === 0) return 0;
  return Math.round((eligible / (eligible + missing)) * 100);
}

export function memoryGb(json: unknown): number {
  const memory = asRecord(asRecord(asRecord(json)?.resources)?.memory);
  return (readNumber(memory, "rssMb") ?? readNumber(memory, "rssMB") ?? 0) / 1024;
}

export function cpuPct(json: unknown): number {
  const resource = asRecord(asRecord(json)?.resources);
  const cpu = asRecord(resource?.cpu);
  return readNumber(cpu, "percent") ?? readNumber(cpu, "usagePercent") ?? readNumber(resource, "cpuPercent") ?? 0;
}

export function buildRollbackTriggers(searchStatus: number, publicApiOk: boolean, memoryRssGb: number, cpuPercent: number, queueAge: number, rejectedUnsafeActions: number, killSwitch: boolean): string[] {
  return [
    searchStatus >= 500 ? "scraper_http_5xx" : "",
    !publicApiOk ? "public_api_mismatch" : "",
    memoryRssGb > 14 ? "memory_over_14gb" : "",
    cpuPercent > 85 ? "cpu_over_85_percent" : "",
    queueAge > 120 ? "queue_age_over_120s" : "",
    rejectedUnsafeActions > 0 ? "unsafe_action_rejected_count_nonzero" : "",
    killSwitch ? "restricted_kill_switch_active" : ""
  ].filter(Boolean);
}
