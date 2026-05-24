import type { AdapterRunResult } from "../types.ts";
import type { MetricSample, MetricsRegistry } from "./metrics.ts";

export interface AdapterMetricInput {
  adapter: string;
  sourceType: string;
  result: Pick<AdapterRunResult, "items" | "warnings" | "metadata">;
  now?: Date;
}

export interface AdapterMetricAlert {
  name: string;
  severity: "warn" | "critical";
  message: string;
  labels: Record<string, string>;
  value: number;
}

export interface AdapterAlertThresholds {
  minRuns: number;
  failureRateWarnPercent: number;
  failureRateCriticalPercent: number;
  rateLimitDelayWarnSeconds: number;
  rateLimitDelayCriticalSeconds: number;
}

export const DEFAULT_ADAPTER_ALERT_THRESHOLDS: AdapterAlertThresholds = {
  minRuns: 20,
  failureRateWarnPercent: 5,
  failureRateCriticalPercent: 20,
  rateLimitDelayWarnSeconds: 5 * 60,
  rateLimitDelayCriticalSeconds: 30 * 60
};

export function recordAdapterRunMetrics(metrics: MetricsRegistry, input: AdapterMetricInput): void {
  const labels = {
    adapter: safeLabel(input.adapter),
    sourceType: safeLabel(input.sourceType)
  };
  const failureCategory = readString(input.result.metadata, "failureCategory");
  const outcome = failureCategory ? "failed" : "ok";
  const now = input.now ?? new Date();

  metrics.increment("scraper_adapter_runs_total", 1, { ...labels, outcome });
  metrics.gauge("scraper_adapter_items_last", input.result.items.length, labels);
  metrics.gauge("scraper_adapter_warnings_last", input.result.warnings.length, labels);

  const fetchDurationMs = readNumber(readRecord(input.result.metadata, "crawlState"), "fetchDurationMs");
  if (fetchDurationMs !== undefined) {
    metrics.gauge("scraper_adapter_fetch_duration_ms", fetchDurationMs, labels);
  }

  if (!failureCategory) return;

  metrics.increment("scraper_adapter_failures_total", 1, { ...labels, category: safeLabel(failureCategory) });

  const rateLimitResetAt =
    readString(input.result.metadata, "rateLimitResetAt") ??
    readString(readRecord(input.result.metadata, "crawlState"), "rateLimitResetAt");
  if (failureCategory === "rate_limited" && rateLimitResetAt) {
    const delaySeconds = Math.max(0, Math.ceil((Date.parse(rateLimitResetAt) - now.getTime()) / 1000));
    metrics.gauge("scraper_adapter_rate_limit_delay_seconds", delaySeconds, labels);
  }
}

export function evaluateAdapterMetricAlerts(
  samples: MetricSample[],
  thresholds: AdapterAlertThresholds = DEFAULT_ADAPTER_ALERT_THRESHOLDS
): AdapterMetricAlert[] {
  const runGroups = new Map<string, { labels: Record<string, string>; total: number; failed: number }>();
  const alerts: AdapterMetricAlert[] = [];

  for (const sample of samples) {
    if (sample.name === "scraper_adapter_runs_total") {
      const key = groupKey(sample.labels);
      const previous = runGroups.get(key) ?? { labels: baseLabels(sample.labels), total: 0, failed: 0 };
      previous.total += sample.value;
      if (sample.labels.outcome === "failed") previous.failed += sample.value;
      runGroups.set(key, previous);
    }

    if (sample.name === "scraper_adapter_rate_limit_delay_seconds") {
      const severity = thresholdSeverity(
        sample.value,
        thresholds.rateLimitDelayWarnSeconds,
        thresholds.rateLimitDelayCriticalSeconds
      );
      if (severity) {
        alerts.push({
          name: "adapter_rate_limit_delay",
          severity,
          message: `adapter ${sample.labels.adapter ?? "unknown"} is rate limited for ${sample.value} seconds`,
          labels: baseLabels(sample.labels),
          value: sample.value
        });
      }
    }
  }

  for (const group of runGroups.values()) {
    if (group.total < thresholds.minRuns) continue;
    const failureRate = (group.failed / group.total) * 100;
    const severity = thresholdSeverity(
      failureRate,
      thresholds.failureRateWarnPercent,
      thresholds.failureRateCriticalPercent
    );
    if (!severity) continue;
    alerts.push({
      name: "adapter_failure_rate",
      severity,
      message: `adapter ${group.labels.adapter ?? "unknown"} failure rate is ${failureRate.toFixed(1)}%`,
      labels: group.labels,
      value: failureRate
    });
  }

  return alerts.sort((a, b) => a.name.localeCompare(b.name));
}

function thresholdSeverity(value: number, warn: number, critical: number): "warn" | "critical" | undefined {
  if (value >= critical) return "critical";
  if (value >= warn) return "warn";
  return undefined;
}

function groupKey(labels: Record<string, string>): string {
  const base = baseLabels(labels);
  return JSON.stringify(Object.entries(base).sort());
}

function baseLabels(labels: Record<string, string>): Record<string, string> {
  return {
    adapter: labels.adapter ?? "unknown",
    sourceType: labels.sourceType ?? "unknown"
  };
}

function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80) || "unknown";
}

function readRecord(record: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
  const value = record?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
