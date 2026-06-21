import type { MetricSample } from "./metrics.ts";
import type { AdapterAlertThresholds, AdapterMetricAlert } from "./adapterMetricTypes.ts";
import { baseLabels, groupKey, thresholdSeverity } from "./adapterMetricAlertLabels.ts";
import { DEFAULT_ADAPTER_ALERT_THRESHOLDS } from "./adapterMetricTypes.ts";

export function evaluateAdapterMetricAlerts(
  samples: MetricSample[],
  thresholds: AdapterAlertThresholds = DEFAULT_ADAPTER_ALERT_THRESHOLDS
): AdapterMetricAlert[] {
  const runGroups = new Map<string, { labels: Record<string, string>; total: number; failed: number }>();
  const alerts: AdapterMetricAlert[] = [];

  for (const sample of samples) {
    if (sample.name === "scraper_adapter_runs_total") recordRunSample(sample, runGroups);
    if (sample.name === "scraper_adapter_rate_limit_delay_seconds") pushRateLimitAlert(sample, thresholds, alerts);
  }

  for (const group of runGroups.values()) pushFailureRateAlert(group, thresholds, alerts);
  return alerts.sort((a, b) => a.name.localeCompare(b.name));
}

function recordRunSample(sample: MetricSample, groups: Map<string, { labels: Record<string, string>; total: number; failed: number }>): void {
  const key = groupKey(sample.labels);
  const previous = groups.get(key) ?? { labels: baseLabels(sample.labels), total: 0, failed: 0 };
  previous.total += sample.value;
  if (sample.labels.outcome === "failed") previous.failed += sample.value;
  groups.set(key, previous);
}

function pushRateLimitAlert(
  sample: MetricSample,
  thresholds: AdapterAlertThresholds,
  alerts: AdapterMetricAlert[]
): void {
  const severity = thresholdSeverity(sample.value, thresholds.rateLimitDelayWarnSeconds, thresholds.rateLimitDelayCriticalSeconds);
  if (!severity) return;
  alerts.push({
    name: "adapter_rate_limit_delay",
    severity,
    message: `adapter ${sample.labels.adapter ?? "unknown"} is rate limited for ${sample.value} seconds`,
    labels: baseLabels(sample.labels),
    value: sample.value
  });
}

function pushFailureRateAlert(
  group: { labels: Record<string, string>; total: number; failed: number },
  thresholds: AdapterAlertThresholds,
  alerts: AdapterMetricAlert[]
): void {
  if (group.total < thresholds.minRuns) return;
  const failureRate = (group.failed / group.total) * 100;
  const severity = thresholdSeverity(failureRate, thresholds.failureRateWarnPercent, thresholds.failureRateCriticalPercent);
  if (!severity) return;
  alerts.push({ name: "adapter_failure_rate", severity, message: `adapter ${group.labels.adapter ?? "unknown"} failure rate is ${failureRate.toFixed(1)}%`, labels: group.labels, value: failureRate });
}
