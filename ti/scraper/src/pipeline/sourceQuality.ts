import type { CaptureMetadataStore } from "../storage/evidenceStoreTypes.ts";

export function buildSourceQualityReport(store: CaptureMetadataStore, input: { tenantId?: string; windowDays?: number; generatedAt?: string } = {}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const cutoff = Date.parse(generatedAt) - Math.max(1, input.windowDays ?? 30) * 86_400_000;
  const inScope = (record: any) => input.tenantId ? record?.tenantId == null || record?.tenantId === input.tenantId : true;
  const sources = store.listSources().filter(inScope);
  const health = store.listSourceHealthObservations().filter((row: any) => inScope(row) && Date.parse(String(row.checkedAt ?? "")) >= cutoff);
  const captures = store.listCaptures().filter((row: any) => inScope(row) && Date.parse(String(row.collectedAt ?? "")) >= cutoff);
  const entities = store.listExtractedEntities().filter(inScope);
  const alerts = ((store as any).listDwmAlerts?.() ?? []).filter(inScope);
  const rows = sources.map((source: any) => sourceQuality(source, health.filter((row: any) => row.sourceId === source.id), captures.filter((row: any) => row.sourceId === source.id), entities, alerts, generatedAt));
  return { schemaVersion: "ti.source_quality.v1", generatedAt, windowDays: Math.max(1, input.windowDays ?? 30), sourceCount: rows.length, rows };
}

function sourceQuality(source: any, health: any[], captures: any[], entities: any[], alerts: any[], generatedAt: string) {
  const attempts = health.length;
  const successful = health.filter((row) => row.success === true).length;
  const parserSuccessful = health.filter((row) => row.success === true && Number(row.parserWarningCount ?? row.parser_warning_count ?? 0) === 0).length;
  const useful = health.filter((row) => row.useful === true).length;
  const duplicateCount = health.reduce((sum, row) => sum + Math.max(0, Number(row.duplicateCount ?? row.duplicate_count ?? 0) || 0), 0);
  const uniqueOutputCount = captures.filter((capture) => !capture.metadata?.duplicateOf && capture.metadata?.duplicate !== true && capture.metadata?.duplicateArticle !== true).length;
  const observedOutputCount = uniqueOutputCount + duplicateCount;
  const matchedCaptureIds = new Set<string>();
  for (const alert of alerts) {
    const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
    const sourceMatch = alert.provenance?.sourceIds?.includes(source.id) || evidence.some((item: any) => item.sourceId === source.id || item.provenance?.sourceId === source.id);
    if (!sourceMatch) continue;
    for (const item of evidence) if (item.sourceId === source.id || item.provenance?.sourceId === source.id) if (item.captureId) matchedCaptureIds.add(String(item.captureId));
    if (alert.captureId && !evidence.length) matchedCaptureIds.add(String(alert.captureId));
  }
  const latestCapture = captures.filter((capture) => validDate(capture.collectedAt)).sort((left, right) => Date.parse(right.collectedAt) - Date.parse(left.collectedAt))[0];
  const latestHealth = health.filter((row) => validDate(row.checkedAt)).sort((left, right) => Date.parse(right.checkedAt) - Date.parse(left.checkedAt))[0];
  const publicationTimes = captures.map((capture) => Date.parse(String(capture.publishedAt ?? ""))).filter(Number.isFinite).sort((left, right) => left - right);
  const publicationGaps = publicationTimes.slice(1).map((time, index) => (time - publicationTimes[index]) / 86_400_000).filter((value) => value >= 0);
  const language = counts(captures.flatMap((capture) => [capture.metadata?.language, capture.metadata?.lang].filter(Boolean).map(String)));
  const geography = counts([
    ...captures.flatMap((capture) => [capture.metadata?.country, capture.metadata?.region, capture.metadata?.geography].filter(Boolean).flatMap(value => Array.isArray(value) ? value : [value]).map(String)),
    ...entities.filter((entity: any) => entity.captureId && captures.some((capture) => capture.id === entity.captureId) && ["country", "region", "geography"].includes(String(entity.type))).map((entity: any) => String(entity.normalizedValue ?? entity.value ?? ""))
  ].filter(Boolean));
  const failures = counts(health.filter((row) => row.success !== true).map((row) => String(row.adapterFailureCategory ?? row.failureCategory ?? classifyFailure(row.failureReason))));
  const usefulLatencies = health.filter((row) => row.useful === true).map((row) => Number(row.latencyMs)).filter(Number.isFinite);
  return {
    sourceId: source.id,
    name: source.name,
    family: source.metadata?.sourceFamily ?? source.catalog?.canonicalId ?? source.type ?? "unknown",
    accessMode: source.accessMethod ?? source.metadata?.accessMode ?? source.metadata?.transport ?? "unknown",
    legalMode: source.legalMode ?? source.metadata?.legalMode ?? source.metadata?.collectionMode ?? "unknown",
    sample: { attempts, successfulAttempts: successful, captures: captures.length, uniqueOutputs: uniqueOutputCount, duplicateOutputs: duplicateCount, matchedCaptures: matchedCaptureIds.size },
    collectionSuccessRate: rate(successful, attempts),
    parserSuccessRate: rate(parserSuccessful, successful),
    usefulOutputRate: rate(useful, attempts),
    uniqueOutputRate: rate(uniqueOutputCount, observedOutputCount),
    duplicateRate: rate(duplicateCount, observedOutputCount),
    customerMatchRate: rate(matchedCaptureIds.size, uniqueOutputCount),
    freshness: latestCapture ? { lastCollectedAt: latestCapture.collectedAt, ageSeconds: Math.max(0, (Date.parse(generatedAt) - Date.parse(latestCapture.collectedAt)) / 1000), freshnessLagSeconds: latestHealth?.freshnessLagSeconds ?? latestHealth?.freshness_lag_seconds ?? null } : null,
    averagePublicationFrequencyDays: publicationGaps.length ? round(publicationGaps.reduce((sum, value) => sum + value, 0) / publicationGaps.length) : null,
    language,
    geography,
    failureCategories: failures,
    timeToUsefulOutputMs: usefulLatencies.length ? { average: round(usefulLatencies.reduce((sum, value) => sum + value, 0) / usefulLatencies.length), p95: percentile(usefulLatencies, 0.95), sampleSize: usefulLatencies.length } : null
  };
}

function rate(numerator: number, denominator: number) { return denominator > 0 ? round(numerator / denominator) : null; }
function counts(values: string[]) { const output: Record<string, number> = {}; for (const value of values) output[value] = (output[value] ?? 0) + 1; return output; }
function validDate(value: unknown) { return Number.isFinite(Date.parse(String(value ?? ""))); }
function percentile(values: number[], fraction: number) { const sorted = [...values].sort((left, right) => left - right); return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null; }
function round(value: number) { return Number(value.toFixed(3)); }
function classifyFailure(value: unknown) { const text = String(value ?? "unknown").toLowerCase(); if (text.includes("timeout")) return "timeout"; if (text.includes("http") || text.includes("status")) return "http_error"; if (text.includes("parse") || text.includes("extract")) return "parser_failure"; if (text.includes("rate")) return "rate_limited"; return text === "" ? "unknown" : "transport_error"; }
