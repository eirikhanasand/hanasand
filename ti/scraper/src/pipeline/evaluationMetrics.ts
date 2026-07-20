const LATENCIES = [
  "reportToPublicationSeconds",
  "publicationToCollectionSeconds",
  "collectionToProcessingSeconds",
  "processingToVisibilitySeconds",
  "visibilityToAlertSeconds",
  "reportToVisibilitySeconds",
  "reportToAlertSeconds"
] as const;

export function buildEvaluationMetrics(store: any, input: { tenantId?: string; datasetSplit?: string; generatedAt?: string } = {}) {
  const scoped = (method: string) => records(store, method).filter((record) => sameTenant(record.tenantId, input.tenantId));
  const sources = scoped("listSources"), captures = scoped("listCaptures"), entities = scoped("listExtractedEntities"), indicators = scoped("listIndicators"), incidents = scoped("listIncidents"), claims = scoped("listIntelligenceClaims");
  const sourceById = new Map(sources.map((source: any) => [source.id, source]));
  const captureById = new Map(captures.map((capture: any) => [capture.id, capture]));
  const subjects = new Map([...entities, ...indicators, ...incidents, ...claims].map((record: any) => [record.id, record]));
  const labelEvents = scoped("listEvaluationLabels").filter((label: any) => !input.datasetSplit || label.datasetSplit === input.datasetSplit);
  const labels = latestLabels(labelEvents);
  const rows = labels.map((label: any) => labelRow(label, subjects, captureById, sourceById));
  const timeliness = scoped("listTimelinessRecords");
  const health = scoped("listSourceHealthObservations");
  const validations = scoped("listValidationRecords");

  return {
    schemaVersion: "ti.evaluation_metrics.v1",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: { tenantId: input.tenantId ?? null, datasetSplit: input.datasetSplit ?? "all" },
    quality: {
      status: labels.length ? "measured" : "unmeasured",
      labelEventCount: labelEvents.length,
      evaluatedUnitCount: labels.length,
      supersededLabelCount: labelEvents.length - labels.length,
      classifiedCount: rows.filter((row: any) => row.bucket !== "needs_review").length,
      needsReviewCount: rows.filter((row: any) => row.bucket === "needs_review").length,
      overall: score(rows),
      byLabelType: groupedScores(rows, (row) => row.labelType),
      byParser: groupedScores(rows, (row) => row.parserVersion),
      bySourceFamily: groupedScores(rows, (row) => row.sourceFamily),
      byDatasetSplit: groupedScores(rows, (row) => row.datasetSplit)
    },
    timeliness: {
      status: timeliness.length ? "measured" : "unmeasured",
      recordCount: timeliness.length,
      anomalyCount: timeliness.filter((record: any) => record.timestampAnomalies?.length).length,
      overall: latencySummary(timeliness),
      bySourceFamily: groupedLatencies(timeliness, (record) => sourceFamily(sourceById.get(record.sourceId)))
    },
    coverage: coverage(sources, captures, entities, health),
    validation: {
      recordCount: validations.length,
      statuses: countBy(validations, (record) => record.status ?? "unknown"),
      referenceHostCount: new Set(validations.map((record: any) => hostname(record.referenceUrl)).filter(Boolean)).size
    },
    limitations: [
      !labels.length && "no evaluation labels in scope",
      !rows.some((row: any) => row.bucket === "false_negative") && "recall is unmeasured until false-negative labels exist",
      !timeliness.some((record: any) => record.alertedAt) && "alert-delivery latency is unmeasured"
    ].filter(Boolean)
  };
}

function labelRow(label: any, subjects: Map<string, any>, captures: Map<string, any>, sources: Map<string, any>) {
  const subjectId = label.entityId ?? label.indicatorId ?? label.incidentId ?? label.claimId;
  const subject = subjects.get(subjectId);
  const capture = captures.get(label.captureId ?? subject?.captureId ?? subject?.captureIds?.[0]);
  const source = sources.get(capture?.sourceId ?? subject?.sourceId ?? subject?.sourceIds?.[0]);
  return {
    labelType: label.labelType ?? "unknown",
    datasetSplit: label.datasetSplit ?? "unassigned",
    bucket: outcomeBucket(label.outcome),
    parserVersion: subject?.extractorVersion ?? capture?.metadata?.extractorVersion ?? capture?.provenance?.extractorVersion ?? "unknown",
    sourceFamily: sourceFamily(source)
  };
}

function latestLabels(labels: any[]): any[] {
  const latest = new Map<string, any>();
  for (const label of labels) {
    const subjectId = label.captureId ?? label.entityId ?? label.indicatorId ?? label.incidentId ?? label.claimId ?? "unknown";
    const key = `${subjectId}:${label.labelType ?? "unknown"}:${label.datasetSplit ?? "unassigned"}`;
    const previous = latest.get(key);
    if (!previous || String(label.labeledAt ?? label.id).localeCompare(String(previous.labeledAt ?? previous.id)) > 0) latest.set(key, label);
  }
  return [...latest.values()];
}

function score(rows: any[]) {
  const counts = { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0, needsReview: 0 };
  for (const row of rows) {
    if (row.bucket === "true_positive") counts.truePositive++;
    else if (row.bucket === "false_positive") counts.falsePositive++;
    else if (row.bucket === "false_negative") counts.falseNegative++;
    else if (row.bucket === "true_negative") counts.trueNegative++;
    else counts.needsReview++;
  }
  const precision = ratio(counts.truePositive, counts.truePositive + counts.falsePositive);
  const recall = ratio(counts.truePositive, counts.truePositive + counts.falseNegative);
  return { ...counts, precision, recall, f1: precision === null || recall === null || precision + recall === 0 ? null : round((2 * precision * recall) / (precision + recall)) };
}

function groupedScores(rows: any[], key: (row: any) => string) {
  return group(rows, key).map(([name, values]) => ({ name, sampleSize: values.length, ...score(values) }));
}

function latencySummary(records: any[]) {
  return Object.fromEntries(LATENCIES.map((field) => {
    const values = records.map((record) => Number(record.latencies?.[field])).filter((value) => Number.isFinite(value) && value >= 0);
    return [field, { sampleSize: values.length, medianSeconds: percentile(values, 0.5), p95Seconds: percentile(values, 0.95) }];
  }));
}

function groupedLatencies(records: any[], key: (record: any) => string) {
  return group(records, key).map(([name, values]) => ({ name, recordCount: values.length, metrics: latencySummary(values) }));
}

function coverage(sources: any[], captures: any[], entities: any[], health: any[]) {
  const active = sources.filter((source) => ["active", "canary", "probation", "degraded"].includes(source.status));
  const attempted = new Set(health.map((row) => row.sourceId));
  const successful = new Set(health.filter((row) => row.success).map((row) => row.sourceId));
  const useful = new Set(health.filter((row) => row.useful).map((row) => row.sourceId));
  return {
    registeredSourceCount: sources.length,
    activeSourceCount: active.length,
    attemptedSourceCount: attempted.size,
    successfulSourceCount: successful.size,
    usefulSourceCount: useful.size,
    capturedSourceCount: new Set(captures.map((capture) => capture.sourceId)).size,
    actorCount: new Set(entities.filter((entity) => entity.type === "actor" || entity.type === "ransomware_family").map((entity) => String(entity.normalizedValue ?? entity.value).toLowerCase())).size,
    activeAttemptRate: ratio([...attempted].filter((sourceId) => active.some((source) => source.id === sourceId)).length, active.length),
    attemptSuccessRate: ratio(successful.size, attempted.size),
    usefulSourceRate: ratio(useful.size, attempted.size),
    sourceFamilies: countBy(sources, sourceFamily)
  };
}

function outcomeBucket(outcome: string): string {
  if (outcome === "true_positive" || outcome === "correct") return "true_positive";
  if (outcome === "false_positive" || outcome === "incorrect") return "false_positive";
  if (outcome === "false_negative") return "false_negative";
  if (outcome === "true_negative") return "true_negative";
  return "needs_review";
}

function sourceFamily(source: any): string { return source?.metadata?.sourceFamily ?? source?.catalog?.canonicalId ?? source?.type ?? "unknown"; }
function records(store: any, method: string): any[] { return typeof store?.[method] === "function" ? store[method]() : []; }
function sameTenant(recordTenant: unknown, scopeTenant: string | undefined): boolean { return recordTenant === scopeTenant || (recordTenant == null && scopeTenant === undefined); }
function group<T>(values: T[], key: (value: T) => string): Array<[string, T[]]> { const groups = new Map<string, T[]>(); for (const value of values) { const name = key(value) || "unknown"; groups.set(name, [...(groups.get(name) ?? []), value]); } return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)); }
function countBy(values: any[], key: (value: any) => string): Record<string, number> { return Object.fromEntries(group(values, key).map(([name, rows]) => [name, rows.length])); }
function ratio(numerator: number, denominator: number): number | null { return denominator > 0 ? round(numerator / denominator) : null; }
function percentile(values: number[], percentileValue: number): number | null { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.max(0, Math.ceil(sorted.length * percentileValue) - 1)] ?? null; }
function round(value: number): number { return Number(value.toFixed(3)); }
function hostname(value: unknown): string | undefined { try { return new URL(String(value)).hostname.toLowerCase(); } catch { return undefined; } }
