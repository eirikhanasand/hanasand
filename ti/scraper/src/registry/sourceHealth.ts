import type { SourceHealth, SourceRecord } from "../types.ts";
import { effectiveSourceScore } from "./sourceRegistry.ts";

export interface SourceHealthObservation {
  sourceId: string;
  tenantId?: string;
  checkedAt: string;
  success: boolean;
  httpStatus?: number;
  latencyMs?: number;
  parserWarnings?: string[];
  freshnessLagSeconds?: number;
  changedContent?: boolean;
  duplicate?: boolean;
  policyBlocked?: boolean;
  adapterFailureCategory?: string;
}

export interface SourceHealthRollup {
  sourceId: string;
  tenantId?: string;
  windowStart: string;
  windowEnd: string;
  checksTotal: number;
  successes: number;
  failures: number;
  successRate: number;
  errorRate: number;
  httpStatusMix: Record<string, number>;
  parserWarningCount: number;
  parserWarnings: string[];
  medianLatencyMs?: number;
  p95LatencyMs?: number;
  freshnessLagSeconds?: number;
  changedContentRate: number;
  duplicateRate: number;
  policyBlockRate: number;
  adapterFailureCategories: Record<string, number>;
  health: SourceHealth;
}

export interface SourceHealthRollupRow {
  source_id: string;
  tenant_id?: string;
  window_start: string;
  window_end: string;
  checks_total: number;
  successes: number;
  failures: number;
  error_rate: number;
  median_latency_ms?: number;
  p95_latency_ms?: number;
  duplicate_rate: number;
  freshness_lag_seconds?: number;
  parser_confidence?: number;
  adapter_failure_category?: string;
}

export interface SourceScoreHistoryRow {
  source_id: string;
  tenant_id?: string;
  calculated_at: string;
  reliability: number;
  freshness: number;
  relevance: number;
  uniqueness: number;
  parseability: number;
  policy_risk_penalty: number;
  operator_boost: number;
  health_penalty: number;
  effective_score: number;
  reason: string;
  inputs: Record<string, unknown>;
}

export function buildSourceHealthRollup(
  source: Pick<SourceRecord, "id" | "tenantId">,
  observations: SourceHealthObservation[],
  windowStart: string,
  windowEnd: string
): SourceHealthRollup {
  const scoped = observations
    .filter((observation) => observation.sourceId === source.id)
    .filter((observation) => observation.checkedAt >= windowStart && observation.checkedAt < windowEnd)
    .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt));
  const checksTotal = scoped.length;
  const successes = scoped.filter((observation) => observation.success).length;
  const failures = checksTotal - successes;
  const errorRate = ratio(failures, checksTotal);
  const parserWarnings = [...new Set(scoped.flatMap((observation) => observation.parserWarnings ?? []))].sort();
  const latencies = scoped.map((observation) => observation.latencyMs).filter(isFiniteNumber).sort((left, right) => left - right);
  const freshness = scoped.map((observation) => observation.freshnessLagSeconds).filter(isFiniteNumber).sort((left, right) => left - right);
  const consecutiveFailures = countTrailingFailures(scoped);
  const last = scoped.at(-1);
  const lastFailure = [...scoped].reverse().find((observation) => !observation.success);
  const lastSuccess = [...scoped].reverse().find((observation) => observation.success);

  return {
    sourceId: source.id,
    tenantId: source.tenantId,
    windowStart,
    windowEnd,
    checksTotal,
    successes,
    failures,
    successRate: ratio(successes, checksTotal),
    errorRate,
    httpStatusMix: countBy(scoped, (observation) => observation.httpStatus ? String(observation.httpStatus) : "none"),
    parserWarningCount: scoped.reduce((total, observation) => total + (observation.parserWarnings?.length ?? 0), 0),
    parserWarnings,
    medianLatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    freshnessLagSeconds: percentile(freshness, 0.5),
    changedContentRate: ratio(scoped.filter((observation) => observation.changedContent).length, checksTotal),
    duplicateRate: ratio(scoped.filter((observation) => observation.duplicate).length, checksTotal),
    policyBlockRate: ratio(scoped.filter((observation) => observation.policyBlocked).length, checksTotal),
    adapterFailureCategories: countBy(scoped.filter((observation) => observation.adapterFailureCategory), (observation) => observation.adapterFailureCategory ?? "unknown"),
    health: {
      status: healthStatus(errorRate, consecutiveFailures),
      checkedAt: last?.checkedAt,
      lastSuccessAt: lastSuccess?.checkedAt,
      lastFailureAt: lastFailure?.checkedAt,
      consecutiveFailures,
      errorRate,
      medianLatencyMs: percentile(latencies, 0.5),
      lastError: lastFailure?.adapterFailureCategory
    }
  };
}

export function sourceHealthRollupToRow(rollup: SourceHealthRollup): SourceHealthRollupRow {
  return {
    source_id: rollup.sourceId,
    tenant_id: rollup.tenantId,
    window_start: rollup.windowStart,
    window_end: rollup.windowEnd,
    checks_total: rollup.checksTotal,
    successes: rollup.successes,
    failures: rollup.failures,
    error_rate: rollup.errorRate,
    median_latency_ms: rollup.medianLatencyMs,
    p95_latency_ms: rollup.p95LatencyMs,
    duplicate_rate: rollup.duplicateRate,
    freshness_lag_seconds: rollup.freshnessLagSeconds,
    parser_confidence: parserConfidence(rollup),
    adapter_failure_category: dominantCategory(rollup.adapterFailureCategories)
  };
}

export function sourceScoreHistoryRow(
  source: SourceRecord,
  rollup: SourceHealthRollup | undefined,
  calculatedAt: string,
  reason: string
): SourceScoreHistoryRow {
  const scoring = source.scoring ?? {
    reliability: source.trustScore,
    freshness: 0.5,
    relevance: 0.5,
    uniqueness: 0.5,
    parseability: 0.5,
    policyRiskPenalty: source.approvalRequired ? 0.15 : 0,
    operatorBoost: 0
  };
  const healthPenalty = rollup
    ? rollup.health.status === "failing"
      ? 0.25
      : rollup.health.status === "degraded"
        ? 0.1
        : 0
    : 0;
  const scoredSource: SourceRecord = rollup
    ? { ...source, health: rollup.health, scoring }
    : { ...source, scoring };

  return {
    source_id: source.id,
    tenant_id: source.tenantId,
    calculated_at: calculatedAt,
    reliability: scoring.reliability,
    freshness: scoring.freshness,
    relevance: scoring.relevance,
    uniqueness: scoring.uniqueness,
    parseability: scoring.parseability,
    policy_risk_penalty: scoring.policyRiskPenalty,
    operator_boost: scoring.operatorBoost,
    health_penalty: healthPenalty,
    effective_score: effectiveSourceScore(scoredSource),
    reason,
    inputs: {
      sourceId: source.id,
      scoring,
      health: rollup?.health,
      rollup: rollup ? sourceHealthRollupToRow(rollup) : undefined
    }
  };
}

function healthStatus(errorRate: number, consecutiveFailures: number): SourceHealth["status"] {
  if (consecutiveFailures >= 5 || errorRate >= 0.8) return "failing";
  if (consecutiveFailures >= 2 || errorRate >= 0.25) return "degraded";
  return "healthy";
}

function countTrailingFailures(observations: SourceHealthObservation[]): number {
  let count = 0;
  for (const observation of [...observations].reverse()) {
    if (observation.success) break;
    count += 1;
  }
  return count;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function percentile(values: number[], point: number): number | undefined {
  if (values.length === 0) return undefined;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * point) - 1));
  return values[index];
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parserConfidence(rollup: SourceHealthRollup): number | undefined {
  if (rollup.checksTotal === 0) return undefined;
  return Math.max(0, Math.min(1, 1 - rollup.parserWarningCount / rollup.checksTotal));
}

function dominantCategory(counts: Record<string, number>): string | undefined {
  return Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
}
