import { nowIso } from "../utils.ts";
import { buildSourceOperationsSnapshot } from "./sourceOperations.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

export async function publicCoverage(options: ApiServerOptions) {
  const generatedAt = nowIso();
  const operations = await buildSourceOperationsSnapshot(options.store, { generatedAt, limit: 500 });
  const summary: any = operations.summary ?? {};
  const sourceQualification: any = operations.qualification ?? {};
  const measured = summary.measurementState !== "source_counts_only" && sourceQualification.measurementState !== "not_measured";
  const latency = latencySummary((options.store.listTimelinessRecords?.() ?? []).filter((record: any) => !record.tenantId));

  return {
    schemaVersion: "public.coverage.v2",
    generatedAt,
    coverageBoundary: "Qualifying coverage requires repeated useful collection and retained evidence. Registry status alone never counts as coverage. Tenant sources, customer terms, raw evidence, and source URLs are excluded.",
    registry: {
      registeredSourceCount: Number(summary.sourceCount ?? 0),
      executableSourceCount: Number(summary.retainedSourceCount ?? summary.activeSourceCount ?? 0),
      inactiveSourceCount: Number(summary.inactiveSourceCount ?? 0),
    },
    usefulCoverage: {
      measurementState: measured ? "measured" : "not_measured",
      everUsefulSourceCount: measuredCount(summary.everUsefulSourceCount, measured),
      currentlyUsefulSourceCount: measuredCount(summary.usefulSourceCount, measured),
      sustainedUsefulSourceCount: measuredCount(summary.sustainedUsefulSourceCount, measured),
      captureProducingSourceCount: measuredCount(summary.captureProducingSourceCount, measured),
    },
    qualification: {
      measurementState: measured ? "measured" : "not_measured",
      baseline: sourceQualification.baseline,
      counts: measuredValues(sourceQualification.counts, measured),
      gaps: measuredValues(sourceQualification.gaps, measured),
      baselineMet: measured ? sourceQualification.baselineMet === true : null,
    },
    observedAlertLatencySeconds: latency,
    collectionCadenceSeconds: cadenceSummary(operations.sources ?? []),
    definitions: {
      qualifying: "A feed qualifies only after repeated successful and useful scheduled cycles, retained evidence, current content, legal basis, review approval where required, and duplicate exclusion.",
      useful: "Useful counts come from persisted retained captures linked to successful collection cycles; registration and health checks are insufficient.",
      registry: "Registry totals are inventory only and are not added to qualifying coverage.",
      latency: "Observed report-to-alert timing from records with verified timestamps; it is not a contractual SLA or forecast.",
    },
  };
}

function latencySummary(records: any[]) {
  const values = records.map((record) => number(record.latencies?.reportToAlertSeconds)).filter(valid).filter((value) => value >= 0).sort((a, b) => a - b);
  if (!values.length) return { status: "not_enough_observations", sampleCount: 0, medianSeconds: null, p95Seconds: null };
  return { status: "observed", sampleCount: values.length, medianSeconds: percentile(values, 0.5), p95Seconds: percentile(values, 0.95) };
}

function cadenceSummary(sources: any[]) {
  const values = sources.map((source) => number(source.collection?.cadenceSeconds)).filter(valid).sort((a, b) => a - b);
  if (!values.length) return { status: "not_measured", sourceCount: 0, minimumSeconds: null, medianSeconds: null, maximumSeconds: null };
  return {
    status: "observed",
    sourceCount: values.length,
    minimumSeconds: values[0],
    medianSeconds: percentile(values, 0.5),
    maximumSeconds: values.at(-1),
  };
}

function measuredCount(value: unknown, measured: boolean) { return measured ? Math.max(0, Number(value ?? 0)) : null; }
function measuredValues(values: Record<string, unknown> | undefined, measured: boolean) { return Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [key, measuredCount(value, measured)])); }
function percentile(values: number[], fraction: number) { return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)]; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : Number(value); }
function valid(value: number) { return Number.isFinite(value) && value >= 0; }
