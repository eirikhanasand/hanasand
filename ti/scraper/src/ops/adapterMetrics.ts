import type { MetricsRegistry } from "./metrics.ts";
import { readNumber, readRecord, readString, safeLabel } from "./adapterMetricRead.ts";
export { evaluateAdapterMetricAlerts } from "./adapterMetricAlerts.ts";
export { DEFAULT_ADAPTER_ALERT_THRESHOLDS } from "./adapterMetricTypes.ts";
export type { AdapterAlertThresholds, AdapterMetricAlert, AdapterMetricInput } from "./adapterMetricTypes.ts";
import type { AdapterMetricInput } from "./adapterMetricTypes.ts";

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
