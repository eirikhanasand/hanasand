import { nowIso } from "../utils.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

export function publicCoverage(options: ApiServerOptions) {
  const generatedAt = nowIso();
  const sources = options.store.listSources().filter((source: any) => !source.tenantId && source.countsAsCoverage !== false);
  const activeSources = sources.filter((source: any) => source.status === "active");
  const cadence = sources.map((source: any) => number(source.crawlFrequencySeconds)).filter(valid);
  const freshnessTargets = sources.map((source: any) => number(source.catalog?.collection?.freshnessTargetSeconds)).filter(valid);
  const sourceFamilies = counts(sources.map((source: any) => String(source.metadata?.sourceFamily ?? source.catalog?.sourceFamily ?? source.type ?? "other")));
  const regions = counts(sources.map((source: any) => String(source.catalog?.publisher?.country ?? source.catalog?.coverage?.region ?? "not recorded")));
  const staleSources = sources.filter((source: any) => {
    const target = number(source.catalog?.collection?.freshnessTargetSeconds);
    const lastSeen = Date.parse(String(source.lastSeenAt ?? ""));
    return valid(target) && Number.isFinite(lastSeen) && Date.now() - lastSeen > target * 1000;
  }).length;
  const latency = sources.length ? latencySummary(options.store.listTimelinessRecords().filter((record: any) => !record.tenantId)) : emptyLatency();

  return {
    schemaVersion: "public.coverage.v1",
    generatedAt,
    coverageBoundary: "Global source registry aggregates only. Tenant sources, customer terms, raw evidence, and source URLs are excluded.",
    sources: {
      total: sources.length,
      active: activeSources.length,
      stale: staleSources,
      families: sourceFamilies,
      cadenceSeconds: summary(cadence),
      freshnessTargetSeconds: summary(freshnessTargets),
      regions,
    },
    observedAlertLatencySeconds: latency,
    definitions: {
      freshness: "Stale means lastSeenAt is older than the source freshness target. Sources without both values are not counted as stale.",
      latency: "Observed report-to-alert timing from records with verified timestamps; it is not a contractual SLA or forecast.",
      cadence: "Configured collection cadence in the global source registry, not a guarantee that every source publishes on that interval.",
    },
  };
}

function latencySummary(records: any[]) {
  const values = records.map((record) => number(record.latencies?.reportToAlertSeconds)).filter(valid).filter((value) => value >= 0).sort((a, b) => a - b);
  if (!values.length) return emptyLatency();
  return { status: "observed", sampleCount: values.length, medianSeconds: percentile(values, 0.5), p95Seconds: percentile(values, 0.95) };
}

function emptyLatency() { return { status: "not_enough_observations", sampleCount: 0, medianSeconds: null, p95Seconds: null }; }
function percentile(values: number[], fraction: number) { return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)]; }
function summary(values: number[]) { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? { sampleCount: sorted.length, min: sorted[0], median: percentile(sorted, 0.5), max: sorted[sorted.length - 1] } : { sampleCount: 0, min: null, median: null, max: null }; }
function counts(values: string[]) { return Object.fromEntries([...new Set(values)].sort().map((name) => [name, values.filter((value) => value === name).length])); }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : Number(value); }
function valid(value: number) { return Number.isFinite(value) && value > 0; }
