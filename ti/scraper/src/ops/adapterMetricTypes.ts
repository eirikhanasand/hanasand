import type { AdapterRunResult } from "../types.ts";

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
