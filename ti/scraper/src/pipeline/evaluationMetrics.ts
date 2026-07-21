const LATENCIES = [
  "reportToPublicationSeconds",
  "publicationToCollectionSeconds",
  "collectionToProcessingSeconds",
  "processingToVisibilitySeconds",
  "visibilityToAlertSeconds",
  "publicationToAlertSeconds",
  "reportToVisibilitySeconds",
  "reportToAlertSeconds"
] as const;
const REQUIRED_BENCHMARK_LABEL_TYPES = ["actor", "ransomware", "victim", "cve", "malware", "ttp", "country", "sector", "impact", "dataset"];

export function buildEvaluationMetrics(store: any, input: { tenantId?: string; datasetSplit?: string; generatedAt?: string } = {}) {
  const scoped = (method: string) => records(store, method).filter((record) => sameTenant(record.tenantId, input.tenantId));
  const sources = scoped("listSources"), captures = scoped("listCaptures"), entities = scoped("listExtractedEntities"), indicators = scoped("listIndicators"), incidents = scoped("listIncidents"), claims = scoped("listIntelligenceClaims");
  const sourceById = new Map(sources.map((source: any) => [source.id, source]));
  const captureById = new Map(captures.map((capture: any) => [capture.id, capture]));
  const subjects = new Map([...entities, ...indicators, ...incidents, ...claims].map((record: any) => [record.id, record]));
  const labelEvents = scoped("listEvaluationLabels").filter((label: any) => !input.datasetSplit || label.datasetSplit === input.datasetSplit);
  const labels = latestLabels(labelEvents);
  const timeliness = scoped("listTimelinessRecords");
  const health = scoped("listSourceHealthObservations");
  const validations = scoped("listValidationRecords");
  const benchmarks = scoped("listEvaluationBenchmarks").filter((benchmark: any) => !input.datasetSplit || benchmark.datasetSplit === input.datasetSplit);
  const benchmarkIds = new Set(benchmarks.map((benchmark: any) => benchmark.id));
  const annotations = scoped("listEvaluationAnnotations").filter((annotation: any) => benchmarkIds.has(annotation.benchmarkId));
  const adjudications = scoped("listEvaluationAdjudications").filter((adjudication: any) => benchmarkIds.has(adjudication.benchmarkId));
  const completedBenchmarks = benchmarks.filter((benchmark: any) => benchmark.status === "complete" && new Set(adjudications.filter((row: any) => row.benchmarkId === benchmark.id).map((row: any) => row.taskId)).size === Number(benchmark.taskCount));
  const completedBenchmarkIds = new Set(completedBenchmarks.map((benchmark: any) => benchmark.id));
  const independentLabels = labels.filter((label: any) => isIndependentEvaluationLabel(label) && completedBenchmarkIds.has(label.benchmarkId));
  const diagnosticLabels = labels.filter((label: any) => !independentLabels.includes(label));
  const rows = independentLabels.map((label: any) => labelRow(label, subjects, captureById, sourceById));
  const diagnosticRows = diagnosticLabels.map((label: any) => labelRow(label, subjects, captureById, sourceById));
  const completedAnnotations = annotations.filter((annotation: any) => completedBenchmarkIds.has(annotation.benchmarkId));
  const completedAdjudications = adjudications.filter((adjudication: any) => completedBenchmarkIds.has(adjudication.benchmarkId));
  const benchmarkReviewerCount = new Set(completedAnnotations.map((annotation: any) => annotation.reviewerId)).size;
  const benchmarkTaskCount = new Set(completedAdjudications.map((adjudication: any) => `${adjudication.benchmarkId}:${adjudication.taskId}`)).size;
  const benchmarkCaptureCount = new Set(completedBenchmarks.flatMap((benchmark: any) => benchmark.captureIds ?? [])).size;
  const heldOutBenchmarks = completedBenchmarks.filter((benchmark: any) => benchmark.datasetSplit === "test" && benchmark.protocol?.testSplitLocked === true && benchmark.protocol?.datasetUsage === "locked_final_evaluation");
  const heldOutBenchmarkIds = new Set(heldOutBenchmarks.map((benchmark: any) => benchmark.id));
  const heldOutRows = rows.filter((row: any) => heldOutBenchmarkIds.has(row.benchmarkId));
  const heldOutAnnotations = completedAnnotations.filter((annotation: any) => heldOutBenchmarkIds.has(annotation.benchmarkId));
  const heldOutCaptureCount = new Set(heldOutBenchmarks.flatMap((benchmark: any) => benchmark.captureIds ?? [])).size;
  const heldOutReviewerCount = new Set(heldOutAnnotations.map((annotation: any) => annotation.reviewerId)).size;
  const labelTypeCoverage = REQUIRED_BENCHMARK_LABEL_TYPES.map((name) => {
    const values = heldOutRows.filter((row: any) => row.labelType === `${name}_extraction`);
    return { name, sampleSize: values.length, positiveCount: values.filter((row: any) => ["true_positive", "false_negative"].includes(row.bucket)).length, negativeCount: values.filter((row: any) => ["true_negative", "false_positive"].includes(row.bucket)).length };
  });
  const stratifiedCoverageComplete = labelTypeCoverage.every((row) => row.positiveCount >= 5 && row.negativeCount >= 5);
  const heldOutBenchmarkCount = heldOutBenchmarks.length;

  return {
    schemaVersion: "ti.evaluation_metrics.v2",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: { tenantId: input.tenantId ?? null, datasetSplit: input.datasetSplit ?? "all" },
    quality: {
      status: independentLabels.length ? "measured" : labels.length ? "diagnostic_only" : "unmeasured",
      labelEventCount: labelEvents.length,
      evaluatedUnitCount: independentLabels.length,
      diagnosticUnitCount: diagnosticLabels.length,
      supersededLabelCount: labelEvents.length - labels.length,
      classifiedCount: rows.filter((row: any) => row.bucket !== "needs_review").length,
      needsReviewCount: rows.filter((row: any) => row.bucket === "needs_review").length,
      overall: score(rows),
      byLabelType: groupedScores(rows, (row) => row.labelType),
      byParser: groupedScores(rows, (row) => row.parserVersion),
      bySourceFamily: groupedScores(rows, (row) => row.sourceFamily),
      byDatasetSplit: groupedScores(rows, (row) => row.datasetSplit),
      errorBreakdown: {
        byOutcome: countBy(rows, (row) => row.bucket),
        byLabelType: groupedErrors(rows, (row) => row.labelType),
        byParser: groupedErrors(rows, (row) => row.parserVersion),
        bySourceFamily: groupedErrors(rows, (row) => row.sourceFamily),
        byDatasetSplit: groupedErrors(rows, (row) => row.datasetSplit)
      },
      benchmarkEvidence: {
        benchmarkCount: benchmarks.length,
        completedBenchmarkCount: completedBenchmarks.length,
        completedTaskCount: benchmarkTaskCount,
        completedCaptureCount: benchmarkCaptureCount,
        annotationCount: annotations.length,
        adjudicationCount: adjudications.length,
        reviewerCount: benchmarkReviewerCount,
        heldOutBenchmarkCount,
        heldOutCaptureCount,
        heldOutReviewerCount,
        labelTypeCoverage,
        stratifiedCoverageComplete,
        validationStatus: heldOutBenchmarkCount > 0 && heldOutCaptureCount >= 50 && heldOutReviewerCount >= 2 && stratifiedCoverageComplete ? "validated" : benchmarks.length ? "pilot_only" : "not_started"
      },
      diagnostics: {
        overall: score(diagnosticRows),
        byLabelingMethod: groupedScores(diagnosticRows, (row) => row.labelingMethod)
      }
    },
    timeliness: {
      status: timeliness.length ? "measured" : "unmeasured",
      recordCount: timeliness.length,
      reportedRecordCount: timeliness.filter((record: any) => record.reportedAt).length,
      alertedRecordCount: timeliness.filter((record: any) => record.alertedAt).length,
      reportToAlertRecordCount: timeliness.filter((record: any) => record.reportedAt && record.alertedAt).length,
      anomalyCount: timeliness.filter((record: any) => record.timestampAnomalies?.length).length,
      overall: latencySummary(timeliness),
      bySourceFamily: groupedLatencies(timeliness, (record) => sourceFamily(sourceById.get(record.sourceId)))
    },
    coverage: coverage(sources, captures, entities, health, claims, rows),
    validation: {
      recordCount: validations.length,
      statuses: countBy(validations, (record) => record.status ?? "unknown"),
      referenceHostCount: new Set(validations.map((record: any) => hostname(record.referenceUrl)).filter(Boolean)).size
    },
    limitations: [
      !labels.length && "no evaluation labels in scope",
      labels.length > 0 && !independentLabels.length && "no independently reviewed evaluation labels in scope; automated checks are diagnostic only",
      !rows.some((row: any) => row.exhaustiveExpectedValues) && "recall is unmeasured until an exhaustive prediction-hidden benchmark is adjudicated",
      completedBenchmarks.length === 0 && "no independently reviewed benchmark is complete",
      !timeliness.some((record: any) => record.reportedAt) && "first-report latency is unmeasured until an actor or victim report is independently timestamped",
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
    benchmarkId: label.benchmarkId,
    labelType: label.labelType ?? "unknown",
    datasetSplit: label.datasetSplit ?? "unassigned",
    bucket: outcomeBucket(label.outcome),
    labelingMethod: evaluationLabelMethod(label),
    parserVersion: label.parserVersion ?? subject?.extractorVersion ?? capture?.metadata?.extractorVersion ?? capture?.provenance?.extractorVersion ?? "unknown",
    sourceFamily: label.sourceFamily ?? sourceFamily(source),
    predictionConfidence: normalizedConfidence(label.predictionConfidence),
    exhaustiveExpectedValues: label.exhaustiveExpectedValues === true && label.blinded === true && label.adjudicationStatus === "adjudicated"
  };
}

export function evaluationLabelMethod(label: any): string {
  if (typeof label?.labelingMethod === "string" && label.labelingMethod.trim()) return label.labelingMethod.trim();
  if (label?.labeledBy === "cisa-kev-authoritative-v1") return "source_field_parity";
  if (label?.labeledBy === "cross-source-corroboration-v1") return "cross_source_corroboration";
  if (label?.labeledBy === "thesis-evaluation-audit") return "manual_source_review";
  return "unspecified";
}

export function isIndependentEvaluationLabel(label: any): boolean {
  return evaluationLabelMethod(label) === "manual_source_review"
    && label?.independentFromExtractor === true
    && Boolean(label?.benchmarkId)
    && label?.blinded === true
    && label?.exhaustiveExpectedValues === true
    && label?.adjudicationStatus === "adjudicated";
}

function latestLabels(labels: any[]): any[] {
  const latest = new Map<string, any>();
  for (const label of labels) {
    const subjectId = label.captureId ?? label.entityId ?? label.indicatorId ?? label.incidentId ?? label.claimId ?? "unknown";
    const key = label.evaluationUnitId ?? `${subjectId}:${label.labelType ?? "unknown"}:${label.datasetSplit ?? "unassigned"}`;
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
  const exhaustive = rows.filter((row: any) => row.exhaustiveExpectedValues);
  const exhaustiveTruePositive = exhaustive.filter((row: any) => row.bucket === "true_positive").length;
  const exhaustiveFalseNegative = exhaustive.filter((row: any) => row.bucket === "false_negative").length;
  const exhaustiveTrueNegative = exhaustive.filter((row: any) => row.bucket === "true_negative").length;
  const exhaustiveFalsePositive = exhaustive.filter((row: any) => row.bucket === "false_positive").length;
  const recall = ratio(exhaustiveTruePositive, exhaustiveTruePositive + exhaustiveFalseNegative);
  const specificity = ratio(exhaustiveTrueNegative, exhaustiveTrueNegative + exhaustiveFalsePositive);
  return { ...counts, precision, recall, specificity, recallSampleSize: exhaustiveTruePositive + exhaustiveFalseNegative, f1: precision === null || recall === null ? null : precision + recall === 0 ? 0 : round((2 * precision * recall) / (precision + recall)), calibration: calibration(rows) };
}

function groupedScores(rows: any[], key: (row: any) => string) {
  return group(rows, key).map(([name, values]) => ({ name, sampleSize: values.length, ...score(values) }));
}

function groupedErrors(rows: any[], key: (row: any) => string) {
  return group(rows.filter((row) => row.bucket === "false_positive" || row.bucket === "false_negative"), key).map(([name, values]) => ({ name, falsePositive: values.filter((row) => row.bucket === "false_positive").length, falseNegative: values.filter((row) => row.bucket === "false_negative").length }));
}

function calibration(rows: any[]) {
  const values = rows.filter((row) => row.predictionConfidence !== undefined).map((row) => ({ confidence: row.predictionConfidence as number, target: row.bucket === "true_positive" || row.bucket === "false_negative" ? 1 : 0 }));
  if (!values.length) return { sampleSize: 0, brierScore: null, expectedCalibrationError: null, bins: [] };
  const bins = Array.from({ length: 5 }, (_, index) => {
    const selected = values.filter((row) => Math.min(4, Math.floor(row.confidence * 5)) === index);
    const averageConfidence = selected.length ? round(selected.reduce((sum, row) => sum + row.confidence, 0) / selected.length) : null;
    const observedFrequency = selected.length ? round(selected.reduce((sum, row) => sum + row.target, 0) / selected.length) : null;
    return { lowerBound: index / 5, upperBound: (index + 1) / 5, sampleSize: selected.length, averageConfidence, observedFrequency };
  }).filter((bin) => bin.sampleSize > 0);
  const brierScore = round(values.reduce((sum, row) => sum + ((row.confidence - row.target) ** 2), 0) / values.length);
  const expectedCalibrationError = round(bins.reduce((sum, bin) => sum + (bin.sampleSize / values.length) * Math.abs((bin.averageConfidence ?? 0) - (bin.observedFrequency ?? 0)), 0));
  return { sampleSize: values.length, brierScore, expectedCalibrationError, bins };
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

function coverage(sources: any[], captures: any[], entities: any[], health: any[], claims: any[], labels: any[]) {
  const active = sources.filter((source) => ["active", "canary", "probation", "degraded"].includes(source.status));
  const attempted = new Set(health.map((row) => row.sourceId));
  const successful = new Set(health.filter((row) => row.success).map((row) => row.sourceId));
  const useful = new Set(health.filter((row) => row.useful).map((row) => row.sourceId));
  const activeIds = new Set(active.map((source) => source.id));
  const activeAttempts = health.filter((row) => activeIds.has(row.sourceId));
  const classifiedLabels = labels.filter((row) => row.bucket !== "needs_review");
  const corroborated = claims.filter((claim) => claim.corroborationState === "corroborated");
  const contradicted = claims.filter((claim) => claim.reviewState === "contradicted" || claim.corroborationState === "contradicted");
  const observedItems = sum(health, "itemCount"), duplicates = sum(health, "duplicateCount");
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
    sourceAttemptCount: health.length,
    activeSourceReliabilityRate: ratio(activeAttempts.filter((row) => row.success).length, activeAttempts.length),
    usefulAttemptRate: ratio(health.filter((row) => row.useful).length, health.length),
    duplicateObservationCount: duplicates,
    duplicationRate: ratio(duplicates, observedItems),
    claimCount: claims.length,
    corroboratedClaimCount: corroborated.length,
    contradictedClaimCount: contradicted.length,
    corroborationRate: ratio(corroborated.length, claims.length),
    falsePositiveRate: ratio(classifiedLabels.filter((row) => row.bucket === "false_positive").length, classifiedLabels.length),
    falsePositiveSampleSize: classifiedLabels.length,
    sourceFamilies: countBy(sources, sourceFamily)
  };
}
function sum(rows: any[], field: string): number { return rows.reduce((total, row) => total + Math.max(0, Number(row[field]) || 0), 0); }

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
function normalizedConfidence(value: unknown): number | undefined { if (value === null || value === undefined || value === "") return undefined; const number = Number(value); return Number.isFinite(number) && number >= 0 && number <= 1 ? number : undefined; }
function hostname(value: unknown): string | undefined { try { return new URL(String(value)).hostname.toLowerCase(); } catch { return undefined; } }
