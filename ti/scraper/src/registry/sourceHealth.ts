import type { SourceHealth, SourceRecord } from "../types.ts";
import { effectiveSourceScore } from "./sourceRegistry.ts";

export type SourceHealthObservation = { sourceId: string; tenantId?: string; checkedAt: string; success: boolean; httpStatus?: number; latencyMs?: number; parserWarnings?: string[]; freshnessLagSeconds?: number; changedContent?: boolean; duplicate?: boolean; policyBlocked?: boolean; adapterFailureCategory?: string };
export type SourceHealthRollup = any; export type SourceHealthRollupRow = any; export type SourceScoreHistoryRow = any;

export function buildSourceHealthRollup(source: Pick<SourceRecord, "id" | "tenantId">, observations: SourceHealthObservation[], windowStart: string, windowEnd: string): SourceHealthRollup {
  const rows = observations.filter((o) => o.sourceId === source.id && o.checkedAt >= windowStart && o.checkedAt < windowEnd).sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  const checksTotal = rows.length, successes = rows.filter((o) => o.success).length, failures = checksTotal - successes, errorRate = ratio(failures, checksTotal);
  const latencies = nums(rows.map((o) => o.latencyMs)), freshness = nums(rows.map((o) => o.freshnessLagSeconds)), lastFailure = [...rows].reverse().find((o) => !o.success), lastSuccess = [...rows].reverse().find((o) => o.success), consecutiveFailures = trailingFailures(rows);
  return { sourceId: source.id, tenantId: source.tenantId, windowStart, windowEnd, checksTotal, successes, failures, successRate: ratio(successes, checksTotal), errorRate, httpStatusMix: countBy(rows, (o) => o.httpStatus ? String(o.httpStatus) : "none"), parserWarningCount: rows.reduce((n, o) => n + (o.parserWarnings?.length ?? 0), 0), parserWarnings: uniq(rows.flatMap((o) => o.parserWarnings ?? [])), medianLatencyMs: pct(latencies, 0.5), p95LatencyMs: pct(latencies, 0.95), freshnessLagSeconds: pct(freshness, 0.5), changedContentRate: ratio(rows.filter((o) => o.changedContent).length, checksTotal), duplicateRate: ratio(rows.filter((o) => o.duplicate).length, checksTotal), policyBlockRate: ratio(rows.filter((o) => o.policyBlocked).length, checksTotal), adapterFailureCategories: countBy(rows.filter((o) => o.adapterFailureCategory), (o) => o.adapterFailureCategory ?? "unknown"), health: { status: status(errorRate, consecutiveFailures), checkedAt: rows.at(-1)?.checkedAt, lastSuccessAt: lastSuccess?.checkedAt, lastFailureAt: lastFailure?.checkedAt, consecutiveFailures, errorRate, medianLatencyMs: pct(latencies, 0.5), lastError: lastFailure?.adapterFailureCategory } };
}

export function sourceHealthRollupToRow(rollup: SourceHealthRollup): SourceHealthRollupRow {
  return { source_id: rollup.sourceId, tenant_id: rollup.tenantId, window_start: rollup.windowStart, window_end: rollup.windowEnd, checks_total: rollup.checksTotal, successes: rollup.successes, failures: rollup.failures, error_rate: rollup.errorRate, median_latency_ms: rollup.medianLatencyMs, p95_latency_ms: rollup.p95LatencyMs, duplicate_rate: rollup.duplicateRate, freshness_lag_seconds: rollup.freshnessLagSeconds, parser_confidence: parserConfidence(rollup), adapter_failure_category: dominant(rollup.adapterFailureCategories) };
}

export function sourceScoreHistoryRow(source: SourceRecord, rollup: SourceHealthRollup | undefined, calculatedAt: string, reason: string): SourceScoreHistoryRow {
  const scoring = source.scoring ?? { reliability: source.trustScore, freshness: 0.5, relevance: 0.5, uniqueness: 0.5, parseability: 0.5, policyRiskPenalty: source.approvalRequired ? 0.15 : 0, operatorBoost: 0 };
  const healthPenalty = !rollup ? 0 : rollup.health.status === "failing" ? 0.25 : rollup.health.status === "degraded" ? 0.1 : 0;
  const scoredSource: SourceRecord = rollup ? { ...source, health: rollup.health, scoring } : { ...source, scoring };
  return { source_id: source.id, tenant_id: source.tenantId, calculated_at: calculatedAt, reliability: scoring.reliability, freshness: scoring.freshness, relevance: scoring.relevance, uniqueness: scoring.uniqueness, parseability: scoring.parseability, policy_risk_penalty: scoring.policyRiskPenalty, operator_boost: scoring.operatorBoost, health_penalty: healthPenalty, effective_score: effectiveSourceScore(scoredSource), reason, inputs: { sourceId: source.id, scoring, health: rollup?.health, rollup: rollup ? sourceHealthRollupToRow(rollup) : undefined } };
}

function status(errorRate: number, consecutiveFailures: number): SourceHealth["status"] { return consecutiveFailures >= 5 || errorRate >= 0.8 ? "failing" : consecutiveFailures >= 2 || errorRate >= 0.25 ? "degraded" : "healthy"; }
function trailingFailures(rows: SourceHealthObservation[]) { let count = 0; for (const row of [...rows].reverse()) { if (row.success) break; count += 1; } return count; }
const ratio = (n: number, d: number) => d > 0 ? n / d : 0;
const nums = (values: unknown[]) => values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
const pct = (values: number[], point: number) => values.length ? values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * point) - 1))] : undefined;
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> { const out: Record<string, number> = {}; for (const item of items) out[keyFn(item)] = (out[keyFn(item)] ?? 0) + 1; return out; }
const parserConfidence = (r: SourceHealthRollup) => r.checksTotal === 0 ? undefined : Math.max(0, Math.min(1, 1 - r.parserWarningCount / r.checksTotal));
const dominant = (counts: Record<string, number>) => Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
